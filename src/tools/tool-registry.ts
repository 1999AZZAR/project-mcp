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
  }
];
