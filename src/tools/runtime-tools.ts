import { Tool } from '@modelcontextprotocol/sdk/types.js';

const object = (properties: Record<string, object>, required: string[] = []) => ({
  type: 'object' as const, properties, required, additionalProperties: false,
});

export const runtimeTools: Tool[] = [
  { name: 'sync_central_memory', description: 'Sync the active project knowledge graph into the central memory database (~/memory/memory.db by default) so all projects share one searchable map', inputSchema: object({}) },
  { name: 'set_project_root', description: 'Switch the active project memory database to the given absolute project path. Use at session start when the server was launched outside the project directory', inputSchema: object({ path: { type: 'string', description: 'Absolute path to the project root', pattern: '^/' } }, ['path']) },
  { name: 'setup_pre_commit', description: 'Create a .pre-commit-config.yaml in the active project root and install the Git hooks, on demand. Requires pre-commit to be installed', inputSchema: object({}) },
  { name: 'get_session_context', description: 'Summarize active tasks, open bugs, recent changes, and blockers from project memory', inputSchema: object({ limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 } }) },
  { name: 'analyze_git_changes', description: 'Analyze bounded Git changes and untracked files in the current workspace', inputSchema: object({ commit: { type: 'string' }, since: { type: 'string', default: '1' }, includeUntracked: { type: 'boolean', default: true }, maxFiles: { type: 'integer', minimum: 1, maximum: 500, default: 100 } }) },
  { name: 'inspect_untrusted_text', description: 'Normalize untrusted text and detect common prompt-injection indicators', inputSchema: object({ text: { type: 'string', description: 'Untrusted text, maximum 256 KiB' } }, ['text']) },
  {
    name: 'security_scan',
    description:
      'Scan for likely hardcoded credentials without exposing values, or scan a container image for HIGH/CRITICAL vulnerabilities with Trivy. Select action: secrets or container.',
    inputSchema: object({
      action: { type: 'string', enum: ['secrets', 'container'], description: 'Scan type' },
      path: { type: 'string', default: '.', description: 'Workspace-relative path for secrets' },
      exclude: { type: 'array', items: { type: 'string' }, description: 'Basenames to exclude' },
      image: { type: 'string', description: 'Container image reference for container scans' },
      maxFindings: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
    }, ['action']),
  },
  {
    name: 'obsidian_vault',
    description:
      'Control the optional Obsidian vault mirror (human-facing view of project memory). Select action: status, sync, rebuild, backfill, sync_central, sync_from_central, or dedup. Requires HELA_GENOME_OBSIDIAN_VAULT for vault actions.',
    inputSchema: object({
      action: { type: 'string', enum: ['status', 'sync', 'rebuild', 'backfill', 'sync_central', 'sync_from_central', 'dedup'], description: 'Operation' },
    }, ['action']),
  },
  {
    name: 'cache',
    description:
      'Read or mutate the optional Redis companion cache. Select action: get, set, delete, or scan. Keys must use the mema:<category>:<name> namespace.',
    inputSchema: object({
      action: { type: 'string', enum: ['get', 'set', 'delete', 'scan'] },
      key: { type: 'string', description: 'Required for get, set, and delete' },
      value: { type: 'string', description: 'Required for set' },
      ttlSeconds: { type: 'integer', minimum: 1, maximum: 604800 },
      pattern: { type: 'string', default: 'mema:*', description: 'Required for scan' },
      cursor: { type: 'integer', minimum: 0, default: 0 },
      count: { type: 'integer', minimum: 1, maximum: 200, default: 100 },
    }, ['action']),
  },
];
