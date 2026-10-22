import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const databaseTools: Tool[] = [
  // Core Database Operations (7 tools)
  {
    name: 'execute_sql',
    description: "Canonical memory-graph SQL inspection (use instead of hela-ribosome opencode_db). Execute raw SQL query on the project or central memory database (database: 'project' | 'central', default 'project')",
    inputSchema: {
      type: 'object',
      properties: {
        database: { type: 'string', enum: ['project', 'central'], description: "Target store: active project database or central aggregate", default: 'project' },
        query: { type: 'string', description: 'SQL query to execute' },
        parameters: { type: 'array', description: 'Query parameters' },
      },
      required: ['query'],
    },
  },
  {
    name: 'query_data',
    description: "Canonical memory-graph table query (use instead of hela-ribosome opencode_db). Query data from project or central memory tables (database: 'project' | 'central', default 'project')",
    inputSchema: {
      type: 'object',
      properties: {
        database: { type: 'string', enum: ['project', 'central'], description: "Target store: active project database or central aggregate", default: 'project' },
        table: { type: 'string', description: 'Table name' },
        conditions: { type: 'object', description: 'WHERE conditions' },
        limit: { type: 'number', minimum: 1, maximum: 10000, description: 'Maximum number of rows' },
        offset: { type: 'number', minimum: 0, description: 'Number of rows to skip' },
        orderBy: { type: 'string', description: 'Column to order by' },
        orderDirection: { type: 'string', enum: ['ASC', 'DESC'], description: 'Sort direction' },
      },
      required: ['table'],
    },
  },
  {
    name: 'insert_data',
    description: "Insert records into a project or central memory table (database: 'project' | 'central', default 'project')",
    inputSchema: {
      type: 'object',
      properties: {
        database: { type: 'string', enum: ['project', 'central'], description: "Target store: active project database or central aggregate", default: 'project' },
        table: { type: 'string', description: 'Table name' },
        records: {
          type: 'array',
          items: { type: 'object' },
          description: 'Array of records to insert',
        },
      },
      required: ['table', 'records'],
    },
  },
  {
    name: 'update_data',
    description: 'Update records in memory.db table',
    inputSchema: {
      type: 'object',
      properties: {
        database: { type: 'string', enum: ['project', 'central'], description: "Target store: active project database or central aggregate", default: 'project' },
        table: { type: 'string', description: 'Table name' },
        conditions: { type: 'object', description: 'WHERE conditions' },
        updates: { type: 'object', description: 'Fields to update' },
      },
      required: ['table', 'conditions', 'updates'],
    },
  },
  {
    name: 'delete_data',
    description: 'Delete records from memory.db table',
    inputSchema: {
      type: 'object',
      properties: {
        database: { type: 'string', enum: ['project', 'central'], description: "Target store: active project database or central aggregate", default: 'project' },
        table: { type: 'string', description: 'Table name' },
        conditions: { type: 'object', description: 'WHERE conditions' },
      },
      required: ['table', 'conditions'],
    },
  },
  {
    name: 'import_data',
    description: 'Import data from file into memory.db table',
    inputSchema: {
      type: 'object',
      properties: {
        database: { type: 'string', enum: ['project', 'central'], description: "Target store: active project database or central aggregate", default: 'project' },
        table: { type: 'string', description: 'Table name' },
        filePath: { type: 'string', description: 'Path to the file' },
        format: { type: 'string', enum: ['csv', 'json'], default: 'csv', description: 'File format' },
        options: {
          type: 'object',
          properties: {
            delimiter: { type: 'string', description: 'CSV delimiter' },
            hasHeader: { type: 'boolean', description: 'CSV has header row' },
            encoding: { type: 'string', description: 'File encoding' },
          },
        },
      },
      required: ['table', 'filePath'],
    },
  },
  {
    name: 'export_data',
    description: 'Export memory.db table data to file',
    inputSchema: {
      type: 'object',
      properties: {
        database: { type: 'string', enum: ['project', 'central'], description: "Target store: active project database or central aggregate", default: 'project' },
        table: { type: 'string', description: 'Table name' },
        filePath: { type: 'string', description: 'Output file path' },
        format: { type: 'string', enum: ['csv', 'json'], default: 'csv', description: 'Output format' },
        conditions: { type: 'object', description: 'WHERE conditions' },
        options: {
          type: 'object',
          properties: {
            delimiter: { type: 'string', description: 'CSV delimiter' },
            includeHeader: { type: 'boolean', description: 'Include header in CSV' },
            encoding: { type: 'string', description: 'File encoding' },
          },
        },
      },
      required: ['table', 'filePath'],
    },
  },
];
