import { SQLiteManager } from '../sqlite-manager.js';
import { MemoryManager } from '../memory-manager.js';
import { ImportExportManager } from '../import-export.js';
import { PromptHandlers } from '../prompts/prompt-handlers.js';
import { z } from 'zod';
import {
  ExecuteSqlSchema, QueryDataSchema, InsertDataSchema, UpdateDataSchema,
  DeleteDataSchema, ImportFromFileSchema, ExportToFileSchema,
  MemoryEditSchema,
  SearchNodesSchema, OpenNodesSchema, ReadGraphSchema, ReadGraphStreamSchema, GetFileContextSchema, GetTimelineSchema
} from '../types.js';
import {
  AnalyzeGitChangesSchema, CacheToolSchema,
  GetSessionContextSchema, InspectUntrustedTextSchema, SecurityScanSchema,
  SetProjectRootSchema, SetupPreCommitSchema, SyncCentralMemorySchema,
  HarnessSessionsSchema,
} from '../types.js';
import { normalizeToolCall } from '../tool-aliases.js';
import { locateStores } from '../session-bridge/stores.js';
import { syncHarnessSessions } from '../session-bridge/sync.js';
import { RuntimeCapabilities } from '../runtime/runtime-capabilities.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { join, resolve, isAbsolute } from 'path';

const execFileAsync = promisify(execFile);

const READ_ONLY_PRAGMAS = new Set([
  'application_id', 'auto_vacuum', 'cache_size', 'collation_list', 'compile_options',
  'data_version', 'database_list', 'encoding', 'foreign_key_check', 'foreign_key_list',
  'foreign_keys', 'freelist_count', 'function_list', 'index_info', 'index_list',
  'index_xinfo', 'integrity_check', 'journal_mode', 'locking_mode', 'module_list',
  'page_count', 'page_size', 'pragma_list', 'query_only', 'quick_check',
  'recursive_triggers', 'schema_version', 'synchronous', 'table_info', 'table_list',
  'table_xinfo', 'temp_store', 'user_version',
]);
const NO_ARGUMENT_PRAGMAS = new Set([
  'application_id', 'auto_vacuum', 'cache_size', 'data_version', 'encoding', 'foreign_keys',
  'freelist_count', 'journal_mode', 'locking_mode', 'page_count', 'page_size', 'query_only',
  'recursive_triggers', 'schema_version', 'synchronous', 'temp_store', 'user_version',
]);

export function isReadOnlySql(query: string): boolean {
  const cleaned = query
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/"(?:""|[^"])*"/g, '""')
    .replace(/`(?:``|[^`])*`/g, '``');
  const trimmed = cleaned.trim();
  const head = trimmed.split(/\s+/, 1)[0]?.toUpperCase();
  if (['SELECT', 'VALUES', 'EXPLAIN'].includes(head)) return true;
  if (head === 'WITH') {
    return !/\b(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|ATTACH|DETACH|VACUUM|REINDEX)\b/i.test(cleaned);
  }
  if (head === 'PRAGMA') {
    const body = trimmed.slice(6).trim();
    if (!body || body.includes('=')) return false;
    const name = body.split(/[\s(]/, 1)[0]?.toLowerCase();
    if (!name || !READ_ONLY_PRAGMAS.has(name)) return false;
    return !NO_ARGUMENT_PRAGMAS.has(name) || (body === name);
  }
  return false;
}

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
  memory_edit: MemoryEditSchema,
  search_nodes: SearchNodesSchema,
  open_node: OpenNodesSchema,
  read_graph: ReadGraphSchema,
  get_file_context: GetFileContextSchema,
  get_timeline: GetTimelineSchema,
  get_session_context: GetSessionContextSchema,
  analyze_git_changes: AnalyzeGitChangesSchema,
  inspect_untrusted_text: InspectUntrustedTextSchema,
  security_scan: SecurityScanSchema,
  cache: CacheToolSchema,
  set_project_root: SetProjectRootSchema,
  harness_sessions: HarnessSessionsSchema,
  setup_pre_commit: SetupPreCommitSchema,
  sync_central_memory: SyncCentralMemorySchema,
};

const runtimeToolNames = new Set([
  'set_project_root', 'setup_pre_commit', 'sync_central_memory', 'get_session_context',
  'analyze_git_changes', 'inspect_untrusted_text', 'security_scan', 'cache',
]);

export class RequestHandlers {
  constructor(
    private sqliteManager: SQLiteManager,
    private memoryManager: MemoryManager,
    private importExportManager: ImportExportManager,
    private promptHandlers: PromptHandlers,
    private runtimeCapabilities?: RuntimeCapabilities
  ) {}

  async handleToolCall(name: string, args: any): Promise<any> {
    try {
      const normalized = normalizeToolCall(name, args);
      name = normalized.name;
      args = normalized.args;

      const schema = toolSchemas[name];
      if (schema) {
        args = schema.parse(args);
      }

      if (['execute_sql', 'query_data', 'insert_data', 'update_data', 'delete_data', 'import_data', 'export_data'].includes(name)) {
        return await this.handleDatabaseTool(name, args);
      }

      if (['initialize_memory', 'memory_edit', 'read_graph', 'read_graph_stream', 'search_nodes', 'open_node', 'get_file_context', 'get_timeline', 'harness_sessions'].includes(name)) {
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
    this.importExportManager.setWorkspaceRoot(workspaceRoot);
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
      case 'security_scan':
        return args.action === 'secrets'
          ? this.runtimeCapabilities!.scanProjectSecrets(args)
          : this.runtimeCapabilities!.scanContainerImage(args);
      case 'cache':
        switch (args.action) {
          case 'get': return this.runtimeCapabilities!.cacheGet(args);
          case 'set': return this.runtimeCapabilities!.cacheSet(args);
          case 'delete': return this.runtimeCapabilities!.cacheDelete(args);
          case 'scan': return this.runtimeCapabilities!.cacheScan(args);
        }
        throw new Error(`Unknown cache action: ${args.action}`);
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
        if (!isReadOnlySql(String(args.query || '')) && process.env['HELA_GENOME_ALLOW_SQL_WRITE'] !== 'true') {
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

      case 'memory_edit': {
        switch (args.action) {
          case 'create_entities': {
            const entities = await this.memoryManager.createEntities(args.entities);
            const failedEntities = args.entities.length - entities.length;
            return {
              success: true, data: entities,
              message: failedEntities > 0
                ? `Created ${entities.length}/${args.entities.length} entities (${failedEntities} failed)`
                : `Created ${entities.length} entities`
            };
          }

          case 'create_relations': {
            const relations = await this.memoryManager.createRelations(args.relations);
            const failedRelations = args.relations.length - relations.length;
            return {
              success: true, data: relations,
              message: failedRelations > 0
                ? `Created ${relations.length}/${args.relations.length} relations (${failedRelations} failed)`
                : `Created ${relations.length} relations`
            };
          }

          case 'add_observations': {
            const obsResults = await this.memoryManager.addObservations(args.observations);
            const failedObs = args.observations.length - obsResults.length;
            return {
              success: true,
              message: failedObs > 0
                ? `Added observations to ${obsResults.length}/${args.observations.length} entities (${failedObs} failed)`
                : `Added observations to ${args.observations.length} entities`
            };
          }

          case 'delete_entities':
            await this.memoryManager.deleteEntities(args.entityNames);
            return { success: true, message: `Deleted ${args.entityNames.length} entities` };

          case 'delete_observations': {
            const delResults = await this.memoryManager.deleteObservations(args.deletions);
            const failedDel = args.deletions.length - delResults.length;
            return {
              success: true,
              message: failedDel > 0
                ? `Deleted observations from ${delResults.length}/${args.deletions.length} entities (${failedDel} failed)`
                : `Deleted observations from ${args.deletions.length} entities`
            };
          }

          case 'delete_relations':
            await this.memoryManager.deleteRelations(args.relations);
            return { success: true, message: `Deleted ${args.relations.length} relations` };
        }
        throw new Error(`Unknown memory_edit action: ${args.action}`);
      }

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
        const searchResult = await this.memoryManager.searchNodes(args.query, args.limit, args.mode, args.detailLevel);
        return { success: true, data: searchResult };
      }

      case 'open_node': {
        const entitiesDetails = await this.memoryManager.openNodes(args.names);
        return { success: true, data: entitiesDetails };
      }

      case 'get_file_context': {
        const fileContext = await this.memoryManager.getFileContext(args.filePath);
        return { success: true, data: fileContext };
      }

      case 'get_timeline': {
        const timeline = await this.memoryManager.getTimeline({
          since: args.since,
          entityType: args.entityType,
          limit: args.limit,
        });
        return { success: true, data: timeline };
      }

      case 'harness_sessions': {
        if (args.action === 'list') {
          return { success: true, data: locateStores() };
        }
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
