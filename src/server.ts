import { UIManager } from './ui-manager.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SQLiteManager } from './sqlite-manager.js';
import { ImportExportManager } from './import-export.js';
import { MemoryManager } from './memory-manager.js';
import { execFileSync } from 'child_process';
import { join, resolve, isAbsolute } from 'path';
import { homedir } from 'os';

// Modular imports
import { allTools } from './tools/tool-registry.js';
import { projectGuardianResources } from './resources/resource-registry.js';
import { ResourceHandlers } from './resources/resource-registry.js';
import { projectGuardianPrompts } from './prompts/prompt-registry.js';
import { PromptHandlers } from './prompts/prompt-registry.js';
import { RequestHandlers } from './handlers/request-handlers.js';
import { textResult, errorResult } from './envelope.js';
import { BEHAVIORAL_PROTOCOL_SYSTEM_MESSAGE } from './prompts/behavioral-protocol.js';
import { RuntimeCapabilities } from './runtime/runtime-capabilities.js';
import { PathGuard } from './runtime/path-guard.js';

export class DatabaseMCPServer {
  private server: Server;
  private sqliteManager: SQLiteManager;
  private importExportManager: ImportExportManager;
  private memoryManager: MemoryManager;
  private resourceHandlers: ResourceHandlers;
  private promptHandlers: PromptHandlers;
  private requestHandlers: RequestHandlers;
  private runtimeCapabilities: RuntimeCapabilities;
  private uiManager: UIManager;

  constructor() {
    // Single source of truth for the project root:
    // 1. GUARDIAN_PROJECT_ROOT env var (set per-project in MCP client config)
    // 2. git toplevel from cwd
    // 3. XDG data home (global fallback)
    let dbPath: string;
    let workspaceRoot: string;
    const configuredRoot = process.env.GUARDIAN_PROJECT_ROOT;
    if (configuredRoot && isAbsolute(configuredRoot)) {
      workspaceRoot = resolve(configuredRoot);
      dbPath = workspaceRoot;
    } else {
      try {
        const output = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        if (!output) throw new Error();
        dbPath = output;
        workspaceRoot = resolve(output);
      } catch {
        // Not inside a single git root (e.g. monorepo hub); use current working directory
        workspaceRoot = resolve(process.cwd());
        dbPath = workspaceRoot;
      }
    }

    // Use only memory.db for all operations
    this.sqliteManager = new SQLiteManager(dbPath);
    this.importExportManager = new ImportExportManager(this.sqliteManager);
    this.memoryManager = new MemoryManager(this.sqliteManager, workspaceRoot);
    this.runtimeCapabilities = new RuntimeCapabilities(
      this.memoryManager,
      this.sqliteManager,
      new PathGuard(workspaceRoot)
    );

    // Initialize modular handlers
    this.uiManager = new UIManager(this.memoryManager);
    this.resourceHandlers = new ResourceHandlers(this.memoryManager, this.sqliteManager);
    this.promptHandlers = new PromptHandlers();
    this.requestHandlers = new RequestHandlers(
      this.sqliteManager, 
      this.memoryManager, 
      this.importExportManager,
      this.promptHandlers,
      this.runtimeCapabilities,
      this.uiManager.start.bind(this.uiManager),
      this.uiManager.stop.bind(this.uiManager)
    );

    this.server = new Server(
      {
        name: 'project-guardian-mcp',
        version: '2.0.0-beta-2',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupResourceHandlers();
    this.setupPromptHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: allTools,
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const result = await this.requestHandlers.handleToolCall(name, args);
        // P1-C1: single choke point — HELA_ENVELOPE=true wraps in HelaResult,
        // default returns the legacy raw JSON text byte-identical to before.
        return textResult(name, result);
      } catch (error) {
        return errorResult(
          name,
          error instanceof Error ? error.message : 'Unknown error',
        );
      }
    });
  }


  private setupResourceHandlers(): void {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: projectGuardianResources,
      };
    });

    // Read specific resources
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      try {
        const content = await this.resourceHandlers.handleReadResource(uri);
        return {
          contents: [{
            uri,
            mimeType: uri.includes('best-practices') ? 'text/markdown' : 'application/json',
            text: content,
          }],
        };
      } catch (error) {
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              error: `Failed to read resource: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }),
          }],
          isError: true,
        };
      }
    });
  }

  private async initializeMemorySystem(): Promise<void> {
    try {
      await this.memoryManager.initializeMemoryDatabase();
    } catch (error) {
      console.error('Failed to initialize memory system:', error);
    }
  }

  private setupPromptHandlers(): void {
    // List available prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: projectGuardianPrompts,
      };
    });

    // Get specific prompts
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params;

      try {
        const content = await this.promptHandlers.handleGetPrompt(name, args);
        return {
          description: `Generated prompt for ${name}`,
          messages: [
            {
              role: 'system',
              content: {
                type: 'text',
                text: BEHAVIORAL_PROTOCOL_SYSTEM_MESSAGE,
              },
            },
            {
              role: 'user',
              content: {
                type: 'text',
                text: content,
              },
            },
          ],
        };
      } catch (error) {
        return {
          description: `Error generating prompt for ${name}`,
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            },
          ],
          isError: true,
        };
      }
    });
  }

  private static shutdownHandlersRegistered = false;

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    if (DatabaseMCPServer.shutdownHandlersRegistered) return;
    DatabaseMCPServer.shutdownHandlersRegistered = true;

    const shutdown = async () => {
      await Promise.race([
        Promise.allSettled([this.sqliteManager.closeAllConnections(), this.runtimeCapabilities.close(), this.uiManager.stop()]),
        new Promise(resolve => setTimeout(resolve, 5000))
      ]);
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }

  async run(): Promise<void> {
    await this.initializeMemorySystem();
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
      console.error('Project Guardian MCP server running on stdio');
  }
}
