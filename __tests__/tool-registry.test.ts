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
      expect(toolNames).toContain('create_entity');
      expect(toolNames).toContain('create_relation');
      expect(toolNames).toContain('add_observation');
      expect(toolNames).toContain('delete_entity');
      expect(toolNames).toContain('delete_observation');
      expect(toolNames).toContain('delete_relation');
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
        'scan_project_secrets', 'scan_container_image', 'cache_get', 'cache_set',
        'cache_delete', 'cache_scan',
      ]));
    });

    test('should include session bridge tools', () => {
      const toolNames = allTools.map(t => t.name);

      expect(toolNames).toContain('list_harness_stores');
      expect(toolNames).toContain('sync_harness_sessions');
    });

    test('should have exactly 38 tools', () => {
      expect(allTools).toHaveLength(38);
    });

    test('should include UI tools', () => {
      const toolNames = allTools.map(t => t.name);
      expect(toolNames).toContain('start_ui');
      expect(toolNames).toContain('close_ui');
      expect(toolNames).toContain('stop_ui');
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

    test('should have valid schema for create_entity tool', () => {
      const createEntityTool = allTools.find(t => t.name === 'create_entity');

      expect(createEntityTool).toBeDefined();
      expect(createEntityTool!.inputSchema).toHaveProperty('type', 'object');
      expect(createEntityTool!.inputSchema.properties).toHaveProperty('entities');
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