import { RequestHandlers } from '../src/handlers/request-handlers';
import { SQLiteManager } from '../src/sqlite-manager';
import { ImportExportManager } from '../src/import-export';
import { MemoryManager } from '../src/memory-manager';
import { PromptHandlers } from '../src/prompts/prompt-handlers';
import { existsSync, unlinkSync, rmdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { RuntimeCapabilities } from '../src/runtime/runtime-capabilities';

describe('RequestHandlers', () => {
  let sqliteManager: SQLiteManager;
  let importExportManager: ImportExportManager;
  let memoryManager: MemoryManager;
  let requestHandlers: RequestHandlers;
  let testDbPath: string;
  let runtimeCapabilities: RuntimeCapabilities;
  let inspectedTexts: unknown[];

  beforeEach(async () => {
    // Use unique test directory for each test to avoid conflicts
    testDbPath = `./test-databases-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sqliteManager = new SQLiteManager(testDbPath);
    importExportManager = new ImportExportManager(sqliteManager);
    memoryManager = new MemoryManager(sqliteManager);
    inspectedTexts = [];
    runtimeCapabilities = {
      inspectUntrustedText: (input: unknown) => {
        inspectedTexts.push(input);
        return { suspicious: false, alerts: [] };
      },
    } as unknown as RuntimeCapabilities;
    requestHandlers = new RequestHandlers(
      sqliteManager,
      memoryManager,
      importExportManager,
      new PromptHandlers(),
      runtimeCapabilities
    );

    await memoryManager.initializeMemoryDatabase();
    await sqliteManager.createDatabase('test_db');
  });

  afterEach(async () => {
    await sqliteManager.closeAllConnections();
    // Clean up test database directory
    try {
      if (existsSync(testDbPath)) {
        const files = readdirSync(testDbPath);
        for (const file of files) {
          if (file.endsWith('.db')) {
            unlinkSync(join(testDbPath, file));
          }
        }
        rmdirSync(testDbPath);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Database Tool Handling', () => {
    test('should handle execute_sql tool', async () => {
      const result = await requestHandlers.handleToolCall('execute_sql', {
        query: 'SELECT 1 as test',
        parameters: []
      });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('rows');
    });

    test('should handle query_data tool', async () => {
      // Create test table
      const schema = {
        columns: [
          { name: 'id', type: 'INTEGER', constraints: ['PRIMARY KEY'] },
          { name: 'name', type: 'TEXT' }
        ]
      };
      await sqliteManager.createTable('memory', 'test_table', schema);

      const result = await requestHandlers.handleToolCall('query_data', {
        table: 'test_table',
        conditions: {},
        limit: 10
      });

      expect(result).toHaveProperty('success', true);
    });

    test('should handle insert_data tool', async () => {
      // Create test table
      const schema = {
        columns: [
          { name: 'id', type: 'INTEGER', constraints: ['PRIMARY KEY'] },
          { name: 'name', type: 'TEXT' }
        ]
      };
      await sqliteManager.createTable('memory', 'test_table', schema);

      const result = await requestHandlers.handleToolCall('insert_data', {
        table: 'test_table',
        records: [{ id: 1, name: 'Test' }]
      });

      expect(result).toHaveProperty('success', true);
    });

    test('should handle update_data tool', async () => {
      // Create test table and insert data
      const schema = {
        columns: [
          { name: 'id', type: 'INTEGER', constraints: ['PRIMARY KEY'] },
          { name: 'name', type: 'TEXT' }
        ]
      };
      await sqliteManager.createTable('memory', 'test_table', schema);
      await sqliteManager.insertData('memory', 'test_table', [{ id: 1, name: 'Test' }]);

      const result = await requestHandlers.handleToolCall('update_data', {
        table: 'test_table',
        conditions: { id: 1 },
        updates: { name: 'Updated Test' }
      });

      expect(result).toHaveProperty('success', true);
    });

    test('should handle delete_data tool', async () => {
      // delete_data is gated behind an explicit opt-in; enable it for this
      // test, which exercises the tool rather than the gate.
      process.env['HELA_GENOME_ALLOW_DESTRUCTIVE'] = 'true';
      try {
        // Create test table and insert data
        const schema = {
          columns: [
            { name: 'id', type: 'INTEGER', constraints: ['PRIMARY KEY'] },
            { name: 'name', type: 'TEXT' }
          ]
        };
        await sqliteManager.createTable('memory', 'test_table', schema);
        await sqliteManager.insertData('memory', 'test_table', [{ id: 1, name: 'Test' }]);

        const result = await requestHandlers.handleToolCall('delete_data', {
          table: 'test_table',
          conditions: { id: 1 }
        });

        expect(result).toHaveProperty('success', true);
      } finally {
        delete process.env['HELA_GENOME_ALLOW_DESTRUCTIVE'];
      }
    });

    test('should refuse delete_data unless destructive tools are enabled', async () => {
      delete process.env['HELA_GENOME_ALLOW_DESTRUCTIVE'];
      const schema = {
        columns: [
          { name: 'id', type: 'INTEGER', constraints: ['PRIMARY KEY'] },
          { name: 'name', type: 'TEXT' }
        ]
      };
      await sqliteManager.createTable('memory', 'test_table', schema);
      await sqliteManager.insertData('memory', 'test_table', [{ id: 1, name: 'Test' }]);

      await expect(
        requestHandlers.handleToolCall('delete_data', {
          table: 'test_table',
          conditions: { id: 1 }
        })
      ).rejects.toThrow(/HELA_GENOME_ALLOW_DESTRUCTIVE/);

      // the row must still be there
      const result = await sqliteManager.queryData('memory', 'test_table', {});
      expect(result.success).toBe(true);
      expect(result.data?.rowCount).toBe(1);
    });
  });

  describe('Memory Tool Handling', () => {
    test('should handle initialize_memory tool', async () => {
      const result = await requestHandlers.handleToolCall('initialize_memory', {});

      expect(result).toHaveProperty('success', true);
    });

    test('should handle memory_edit create_entities action', async () => {
      const result = await requestHandlers.handleToolCall('memory_edit', {
        action: 'create_entities',
        entities: [{
          name: 'test_project',
          entityType: 'project',
          observations: ['Test project']
        }]
      });

      expect(result).toHaveProperty('success', true);
    });

    test('should normalize legacy create_entity alias', async () => {
      const result = await requestHandlers.handleToolCall('create_entity', {
        entities: [{
          name: 'alias_project',
          entityType: 'project',
          observations: ['Via a hidden alias']
        }]
      });

      expect(result).toHaveProperty('success', true);
      expect(result.message).toContain('Created 1 entities');
    });

    test('should handle read_graph tool', async () => {
      const result = await requestHandlers.handleToolCall('read_graph', {});

      expect(result).toHaveProperty('success', true);
    });

    test('should handle search_nodes tool', async () => {
      const result = await requestHandlers.handleToolCall('search_nodes', {
        query: 'test'
      });

      expect(result).toHaveProperty('success', true);
    });
  });

  describe('Error Handling', () => {
    test('should handle non-existent tool', async () => {
      await expect(requestHandlers.handleToolCall('non_existent_tool', {}))
        .rejects.toThrow('Unknown tool: non_existent_tool');
    });

    test('should handle invalid tool arguments', async () => {
      await expect(requestHandlers.handleToolCall('query_data', {
        // Missing required 'table' parameter
        conditions: {}
      })).rejects.toThrow('Tool execution failed');
    });
  });

  describe('Runtime Companion Tool Handling', () => {
    test('should validate and dispatch inspect_untrusted_text', async () => {
      const result = await requestHandlers.handleToolCall('inspect_untrusted_text', { text: 'safe text' });
      expect(result).toEqual({ success: true, data: { suspicious: false, alerts: [] } });
      expect(inspectedTexts).toEqual([{ text: 'safe text' }]);
    });

    test('should reject unknown runtime arguments', async () => {
      await expect(requestHandlers.handleToolCall('inspect_untrusted_text', { text: 'safe', extra: true }))
        .rejects.toThrow('Tool execution failed');
    });
  });

  describe('Import/Export Tool Handling', () => {
    test('should handle export_data tool', async () => {
      // Create test table and insert data
      const schema = {
        columns: [
          { name: 'id', type: 'INTEGER', constraints: ['PRIMARY KEY'] },
          { name: 'name', type: 'TEXT' }
        ]
      };
      await sqliteManager.createTable('memory', 'test_table', schema);
      await sqliteManager.insertData('memory', 'test_table', [{ id: 1, name: 'Test' }]);

      const result = await requestHandlers.handleToolCall('export_data', {
        table: 'test_table',
        filePath: './export_test.csv',
        format: 'csv'
      });

      expect(result).toHaveProperty('success', true);

      // Clean up
      if (existsSync('./export_test.csv')) {
        unlinkSync('./export_test.csv');
      }
    });
  });
});
