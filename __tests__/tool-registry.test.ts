import { allTools } from '../src/tools/tool-registry';

describe('ToolRegistry', () => {
  describe('Tool Listing', () => {
    test('should list all available tools', () => {
      expect(Array.isArray(allTools)).toBe(true);
      expect(allTools.length).toBeGreaterThan(0);

      allTools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
      });
    });

    test('should include database tools', () => {
      const toolNames = allTools.map(t => t.name);

      expect(toolNames).toContain('execute_sql');
      expect(toolNames).toContain('query_data');
      expect(toolNames).toContain('insert_data');
      expect(toolNames).toContain('update_data');
      expect(toolNames).toContain('delete_data');
      expect(toolNames).toContain('import_data');
      expect(toolNames).toContain('export_data');
    });

    test('should include memory tools', () => {
      const toolNames = allTools.map(t => t.name);

      expect(toolNames).toContain('initialize_memory');
      expect(toolNames).toContain('memory_edit');
      expect(toolNames).toContain('read_graph');
      expect(toolNames).toContain('search_nodes');
      expect(toolNames).toContain('open_node');
      expect(toolNames).toContain('get_file_context');
      expect(toolNames).toContain('get_timeline');
    });

    test('should include runtime companion tools', () => {
      const toolNames = allTools.map(t => t.name);
      expect(toolNames).toEqual(expect.arrayContaining([
        'get_session_context', 'analyze_git_changes', 'inspect_untrusted_text',
        'security_scan', 'cache',
      ]));
    });

    test('should include session bridge tools', () => {
      const toolNames = allTools.map(t => t.name);

      expect(toolNames).toContain('harness_sessions');
    });

    test('should have exactly 25 tools', () => {
      expect(allTools).toHaveLength(25);
    });
  });

  describe('Tool Schema Validation', () => {
    test('should have valid schema for execute_sql tool', () => {
      const executeSqlTool = allTools.find(t => t.name === 'execute_sql');

      expect(executeSqlTool).toBeDefined();
      expect(executeSqlTool!.inputSchema).toHaveProperty('type', 'object');
      expect(executeSqlTool!.inputSchema.properties).toHaveProperty('query');
      expect(executeSqlTool!.inputSchema.properties).toHaveProperty('parameters');
    });

    test('should have valid schema for memory_edit tool', () => {
      const memoryEditTool = allTools.find(t => t.name === 'memory_edit');

      expect(memoryEditTool).toBeDefined();
      expect(memoryEditTool!.inputSchema).toHaveProperty('type', 'object');
      expect(memoryEditTool!.inputSchema.properties).toHaveProperty('action');
      expect(memoryEditTool!.inputSchema.properties).toHaveProperty('entities');
    });
    test('should have valid schema for get_file_context tool', () => {
      const fileTool = allTools.find(t => t.name === 'get_file_context');
      expect(fileTool).toBeDefined();
      expect(fileTool!.inputSchema).toHaveProperty('type', 'object');
      expect(fileTool!.inputSchema.properties).toHaveProperty('filePath');
    });

    test('should have valid schema for get_timeline tool', () => {
      const timelineTool = allTools.find(t => t.name === 'get_timeline');
      expect(timelineTool).toBeDefined();
      expect(timelineTool!.inputSchema).toHaveProperty('type', 'object');
      expect(timelineTool!.inputSchema.properties).toHaveProperty('limit');
    });
  });
});