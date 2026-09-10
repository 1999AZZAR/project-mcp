import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { databaseTools } from './database-tools.js';
import { memoryTools } from './memory-tools.js';
import { guidanceTools } from './guidance-tools.js';
import { runtimeTools } from './runtime-tools.js';
import { sessionBridgeTools } from './session-bridge-tools.js';

export const allTools: Tool[] = [
  ...databaseTools,
  ...memoryTools,
  ...guidanceTools,
  ...runtimeTools,
  ...sessionBridgeTools,
  {
    name: 'start_ui',
    description: 'Start the Project Guardian Web UI server on demand. Automatically searches for a free port and returns the local HTTP URL.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'close_ui',
    description: 'Stop the Project Guardian Web UI server if running. Use after start_ui or to free port 3000.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'read_graph_stream',
    description: 'Stream the knowledge graph with cursor pagination (500/page, updated_at DESC). Returns entities, relations, nextCursor.',
    inputSchema: {
      type: 'object',
      properties: {
        cursor: { type: 'string', description: 'Base64url cursor from previous nextCursor' },
        limit: { type: 'number', description: 'Max entities per page (1-1000, default 500)' }
      },
      required: []
    }
  },
  {
    name: 'stop_ui',
    description: 'Alias for close_ui — stop the Web UI server.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

;
