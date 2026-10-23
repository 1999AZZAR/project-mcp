import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const sessionBridgeTools: Tool[] = [
  {
    name: 'harness_sessions',
    description:
      'List local agent-harness session stores or sync their session metadata into the knowledge graph. Select action: list (read-only paths/presence/format notes) or sync (redacted titles, summaries, timestamps; supports dryRun).',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list', 'sync'],
          description: 'Operation to perform',
        },
        harnesses: {
          type: 'array',
          items: { type: 'string', enum: ['opencode', 'kilocode', 'zed', 'delta', 'antigravity', 'cursor', 'vscode', 'codex'] },
          description: 'Harnesses to sync (default: all found)',
        },
        project: { type: 'string', description: 'Substring filter on session project/directory' },
        since: { type: 'number', description: 'Only sessions updated after this ms epoch' },
        limit: { type: 'number', description: 'Max sessions per harness (default 50, max 500)' },
        dryRun: { type: 'boolean', description: 'Report what would sync without writing' },
        includeArchived: { type: 'boolean', description: 'Include archived sessions (default false)' },
      },
      required: ['action'],
    },
  },
];
