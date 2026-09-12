import { SQLiteManager } from '../sqlite-manager.js';
import { MemoryManager } from '../memory-manager.js';
import { ImportExportManager } from '../import-export.js';
import { PromptHandlers } from '../prompts/prompt-handlers.js';
import { z } from 'zod';
import {
  ExecuteSqlSchema, QueryDataSchema, InsertDataSchema, UpdateDataSchema,
  DeleteDataSchema, ImportFromFileSchema, ExportToFileSchema,
  CreateEntitiesSchema, CreateRelationsSchema, AddObservationsSchema,
  DeleteEntitiesSchema, DeleteObservationsSchema, DeleteRelationsSchema,
  SearchNodesSchema, OpenNodesSchema, ReadGraphSchema, ReadGraphStreamSchema
} from '../types.js';
import {
  AnalyzeGitChangesSchema, CacheDeleteSchema, CacheGetSchema, CacheScanSchema, CacheSetSchema,
  GetSessionContextSchema, InspectUntrustedTextSchema, ScanContainerImageSchema, ScanProjectSecretsSchema,
  SetProjectRootSchema, SetupPreCommitSchema, SyncCentralMemorySchema,
  ListHarnessStoresSchema, SyncHarnessSessionsSchema,
} from '../types.js';
import { locateStores } from '../session-bridge/stores.js';
import { syncHarnessSessions } from '../session-bridge/sync.js';
import { RuntimeCapabilities } from '../runtime/runtime-capabilities.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { join, resolve, isAbsolute } from 'path';

const execFileAsync = promisify(execFile);

const DatabaseSelector = z.enum(['project', 'central']).default('project');

const toolSchemas: Record<string, z.ZodSchema> = {
  read_graph_stream: ReadGraphStreamSchema,
  execute_sql: ExecuteSqlSchema.omit({ database: true }).extend({ database: DatabaseSelector }),
  query_data: QueryDataSchema.omit({ database: true }).extend({ database: DatabaseSelector }),
  insert_data: InsertDataSchema.omit({ database: true }).extend({ database: DatabaseSelector }),
  update_data: UpdateDataSchema.omit({ database: true }).extend({ database: DatabaseSelector }),
  delete_data: DeleteDataSchema.omit({ database: true }).extend({ database: DatabaseSelector }),
  import_data: ImportFromFileSchema.omit({ database: true }).extend({ database: DatabaseSelector }),
  export_data: ExportToFileSchema.omit({ database: true }).extend({ database: DatabaseSelector }),
  create_entity: CreateEntitiesSchema,
  create_relation: CreateRelationsSchema,
  add_observation: AddObservationsSchema,
  delete_entity: DeleteEntitiesSchema,
  delete_observation: DeleteObservationsSchema,
  delete_relation: DeleteRelationsSchema,
  search_nodes: SearchNodesSchema,
  open_node: OpenNodesSchema,
  read_graph: ReadGraphSchema,
  get_session_context: GetSessionContextSchema,
  analyze_git_changes: AnalyzeGitChangesSchema,
  inspect_untrusted_text: InspectUntrustedTextSchema,
  scan_project_secrets: ScanProjectSecretsSchema,
  scan_container_image: ScanContainerImageSchema,
  cache_get: CacheGetSchema,
  cache_set: CacheSetSchema,
  cache_delete: CacheDeleteSchema,
  cache_scan: CacheScanSchema,
  set_project_root: SetProjectRootSchema,
  list_harness_stores: ListHarnessStoresSchema,
  sync_harness_sessions: SyncHarnessSessionsSchema,  setup_pre_commit: SetupPreCommitSchema,
  sync_central_memory: SyncCentralMemorySchema,
};

const runtimeToolNames = new Set([
  'set_project_root', 'setup_pre_commit', 'sync_central_memory', 'get_session_context',
  'analyze_git_changes', 'inspect_untrusted_text', 'scan_project_secrets',
  'scan_container_image', 'cache_get', 'cache_set', 'cache_delete', 'cache_scan',
]);

export class RequestHandlers {
  constructor(
    private sqliteManager: SQLiteManager,
    private memoryManager: MemoryManager,
    private importExportManager: ImportExportManager,
    private promptHandlers: PromptHandlers,
    private runtimeCapabilities?: RuntimeCapabilities,
    private startUI?: () => Promise<number>,
    private stopUI?: () => Promise<void>
  ) {}

  async handleToolCall(name: string, args: any): Promise<any> {
    try {
      const schema = toolSchemas[name];
      if (schema) {
        args = schema.parse(args);
      }

      if (['execute_sql', 'query_data', 'insert_data', 'update_data', 'delete_data', 'import_data', 'export_data'].includes(name)) {
        return await this.handleDatabaseTool(name, args);
      }

      if (['initialize_memory', 'create_entity', 'create_relation', 'add_observation', 'delete_entity', 'delete_observation', 'delete_relation', 'read_graph', 'search_nodes', 'open_node', 'list_harness_stores', 'sync_harness_sessions'].includes(name)) {
        return await this.handleMemoryTool(name, args);
      }

      if (name === 'get_project_guidance') {
        const guidanceContent = await this.promptHandlers.handleGetPrompt(args.guidance_name, args.arguments || {});
        return {
          success: true,
          data: {
            guidance_name: args.guidance_name,
            instructions: guidanceContent
          },
          message: `Successfully loaded guidance for ${args.guidance_name}`
        };
      }

      if (runtimeToolNames.has(name)) {
        if (!this.runtimeCapabilities) throw new Error('Runtime companions are unavailable');
        return { success: true, data: await this.handleRuntimeTool(name, args) };
      }

      if (name === 'start_ui') {
        if (!this.startUI) throw new Error('UI Server is not available');
        const port = await this.startUI();
        return {
          success: true,
          message: `UI Server successfully started on http://localhost:${port}`
        };
      }

      if (name === 'close_ui' || name === 'stop_ui') {
        if (!this.stopUI) throw new Error('UI Server is not available');
        await this.stopUI();
        return {
          success: true,
          message: 'UI Server stopped'
        };
      }

      throw new Error(`Unknown tool: ${name}`);
    } catch (error) {
      throw new Error(`Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async setProjectRoot(args: { path: string }): Promise<unknown> {
    if (!isAbsolute(args.path)) {
      throw new Error('path must be absolute');
    }

    let workspaceRoot = resolve(args.path);
    try {
      const { stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], { cwd: workspaceRoot, timeout: 5000 });
      const toplevel = stdout.trim();
      if (toplevel) workspaceRoot = resolve(toplevel);
    } catch {
      // Not a Git repository; use the given path as the project root
    }

    await this.sqliteManager.switchDatabasesPath(workspaceRoot);
    this.memoryManager.setTargetRoot(workspaceRoot);
    this.runtimeCapabilities?.setWorkspaceRoot(workspaceRoot);
    await this.memoryManager.initializeMemoryDatabase();

    return {
      projectRoot: workspaceRoot,
      databasePath: join(workspaceRoot, 'memory.db'),
    };
  }

  private async handleRuntimeTool(name: string, args: any): Promise<unknown> {
    switch (name) {
      case 'set_project_root': return this.setProjectRoot(args);
      case 'setup_pre_commit':
        // P0-A7: installs git hooks into the project root — opt-in host mutation.
        if (process.env['HELA_GENOME_ALLOW_DESTRUCTIVE'] !== 'true') {
          throw new Error('setup_pre_commit is disabled (set HELA_GENOME_ALLOW_DESTRUCTIVE=true to enable)');
        }
        await this.memoryManager.setupProjectFiles(); return { message: 'Pre-commit configuration installed in the active project root' };
      case 'sync_central_memory': return this.memoryManager.syncToCentral();
      case 'get_session_context': return this.runtimeCapabilities!.getSessionContext(args);
      case 'analyze_git_changes': return this.runtimeCapabilities!.analyzeGitChanges(args);
      case 'inspect_untrusted_text': return this.runtimeCapabilities!.inspectUntrustedText(args);
      case 'scan_project_secrets': return this.runtimeCapabilities!.scanProjectSecrets(args);
      case 'scan_container_image': return this.runtimeCapabilities!.scanContainerImage(args);
      case 'cache_get': return this.runtimeCapabilities!.cacheGet(args);
      case 'cache_set': return this.runtimeCapabilities!.cacheSet(args);
      case 'cache_delete': return this.runtimeCapabilities!.cacheDelete(args);
      case 'cache_scan': return this.runtimeCapabilities!.cacheScan(args);
      default: throw new Error(`Unknown runtime tool: ${name}`);
    }
  }

  private resolveDatabase(selector: string | undefined): string {
    return selector === 'central' ? this.memoryManager.getCentralDatabaseId() : 'memory';
  }

  private async handleDatabaseTool(name: string, args: any): Promise<any> {
    const database = this.resolveDatabase(args.database);
    switch (name) {
      case 'execute_sql': {
        // P0-A7: raw SQL reads always allowed; writes need explicit opt-in.
        const head = String(args.query || '').trim().split(/\s+/)[0]?.toUpperCase();
        if (!['SELECT', 'WITH', 'PRAGMA', 'EXPLAIN'].includes(head) && process.env['HELA_GENOME_ALLOW_SQL_WRITE'] !== 'true') {
          throw new Error(`refusing ${head || 'empty'} via execute_sql (set HELA_GENOME_ALLOW_SQL_WRITE=true to enable writes)`);
        }
        return await this.sqliteManager.executeSql(database, args.query, args.parameters);
      }

      case 'query_data':
        return await this.sqliteManager.queryData(
          database,
          args.table,
          args.conditions,
          args.limit,
          args.offset,
          args.orderBy,
          args.orderDirection
        );

      case 'insert_data':
        return await this.sqliteManager.insertData(database, args.table, args.records);

      case 'update_data':
        return await this.sqliteManager.updateData(database, args.table, args.conditions, args.updates);

      case 'delete_data':
        // P0-A7: bulk delete is destructive — opt-in.
        if (process.env['HELA_GENOME_ALLOW_DESTRUCTIVE'] !== 'true') {
          throw new Error('delete_data is disabled (set HELA_GENOME_ALLOW_DESTRUCTIVE=true to enable)');
        }
        return await this.sqliteManager.deleteData(database, args.table, args.conditions);

      case 'import_data':
        return await this.importExportManager.importFromFile(
          database,
          args.table,
          args.filePath,
          args.format,
          args.options
        );

      case 'export_data':
        return await this.importExportManager.exportToFile(
          database,
          args.table,
          args.filePath,
          args.format,
          args.conditions,
          args.options
        );
    }
  }

  private async handleMemoryTool(name: string, args: any): Promise<any> {
    switch (name) {
      case 'initialize_memory':
        await this.memoryManager.initializeMemoryDatabase();
        return { success: true, message: 'Memory system initialized successfully' };

      case 'create_entity': {
        const entities = await this.memoryManager.createEntities(args.entities);
        const failedEntities = args.entities.length - entities.length;
        return {
          success: true, data: entities,
          message: failedEntities > 0
            ? `Created ${entities.length}/${args.entities.length} entities (${failedEntities} failed)`
            : `Created ${entities.length} entities`
        };
      }

      case 'create_relation': {
        const relations = await this.memoryManager.createRelations(args.relations);
        const failedRelations = args.relations.length - relations.length;
        return {
          success: true, data: relations,
          message: failedRelations > 0
            ? `Created ${relations.length}/${args.relations.length} relations (${failedRelations} failed)`
            : `Created ${relations.length} relations`
        };
      }

      case 'add_observation': {
        const obsResults = await this.memoryManager.addObservations(args.observations);
        const failedObs = args.observations.length - obsResults.length;
        return {
          success: true,
          message: failedObs > 0
            ? `Added observations to ${obsResults.length}/${args.observations.length} entities (${failedObs} failed)`
            : `Added observations to ${args.observations.length} entities`
        };
      }

      case 'delete_entity':
        await this.memoryManager.deleteEntities(args.entityNames);
        return { success: true, message: `Deleted ${args.entityNames.length} entities` };

      case 'delete_observation': {
        const delResults = await this.memoryManager.deleteObservations(args.deletions);
        const failedDel = args.deletions.length - delResults.length;
        return {
          success: true,
          message: failedDel > 0
            ? `Deleted observations from ${delResults.length}/${args.deletions.length} entities (${failedDel} failed)`
            : `Deleted observations from ${args.deletions.length} entities`
        };
      }

      case 'delete_relation':
        await this.memoryManager.deleteRelations(args.relations);
        return { success: true, message: `Deleted ${args.relations.length} relations` };

      case 'read_graph': {
        const database = args.database;
        if (database) {
          const g = await this.memoryManager.readStore(database === 'central' ? this.memoryManager.getCentralDatabaseId() : 'memory', { limit: args.limit, offset: args.offset });
          return { success: true, data: g };
        }
        const graph = await this.memoryManager.readGraph({ limit: args.limit, offset: args.offset });
        return { success: true, data: graph };
      }

      case 'read_graph_stream': {
        const stream = await this.memoryManager.readGraphStream(args.cursor, args.limit);
        return { success: true, data: stream };
      }

      case 'search_nodes': {
        const searchResult = await this.memoryManager.searchNodes(args.query, args.limit, args.mode);
        return { success: true, data: searchResult };
      }

      case 'open_node': {
        const entitiesDetails = await this.memoryManager.openNodes(args.names);
        return { success: true, data: entitiesDetails };
      }

      case 'list_harness_stores': {
        return { success: true, data: locateStores() };
      }

      case 'sync_harness_sessions': {
        const results = await syncHarnessSessions(this.sqliteManager, this.memoryManager, {
          harnesses: args.harnesses,
          project: args.project,
          since: args.since,
          limit: args.limit,
          dryRun: args.dryRun,
          includeArchived: args.includeArchived,
        });
        const created = results.reduce((n, r) => n + r.created, 0);
        const updated = results.reduce((n, r) => n + r.updated, 0);
        return {
          success: true,
          data: results,
          message: args.dryRun
            ? `Dry run: ${created} would create, ${updated} would update`
            : `Synced ${created} new, ${updated} updated sessions`,
        };
      }
    }
  }
}
