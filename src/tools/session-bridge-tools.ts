import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const sessionBridgeTools: Tool[] = [
  {
    name: 'list_harness_stores',
    description: 'List local agent-harness session stores (opencode, kilocode, zed, delta, antigravity, cursor, vscode, codex): paths, presence, and format notes. Read-only; never touches harness processes.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'sync_harness_sessions',
    description: 'Read-only sync of harness sessions (titles, summaries, timestamps; secrets redacted) into the project knowledge graph as session entities. Incremental via watermarks; supports dry-run.',
    inputSchema: {
      type: 'object',
      properties: {
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
    },
  },
];
