export interface NormalizedToolCall {
  name: string;
  args: Record<string, unknown>;
  deprecated?: string;
}

interface ToolAlias {
  name: string;
  action: string;
}

const TOOL_ALIASES: Record<string, ToolAlias> = {
  create_entity: { name: 'memory_edit', action: 'create_entities' },
  create_relation: { name: 'memory_edit', action: 'create_relations' },
  add_observation: { name: 'memory_edit', action: 'add_observations' },
  delete_entity: { name: 'memory_edit', action: 'delete_entities' },
  delete_observation: { name: 'memory_edit', action: 'delete_observations' },
  delete_relation: { name: 'memory_edit', action: 'delete_relations' },
  cache_get: { name: 'cache', action: 'get' },
  cache_set: { name: 'cache', action: 'set' },
  cache_delete: { name: 'cache', action: 'delete' },
  cache_scan: { name: 'cache', action: 'scan' },
  scan_project_secrets: { name: 'security_scan', action: 'secrets' },
  scan_container_image: { name: 'security_scan', action: 'container' },
  list_harness_stores: { name: 'harness_sessions', action: 'list' },
  sync_harness_sessions: { name: 'harness_sessions', action: 'sync' },
  start_ui: { name: 'ui_server', action: 'start' },
  close_ui: { name: 'ui_server', action: 'stop' },
  stop_ui: { name: 'ui_server', action: 'stop' },
};

export function normalizeToolCall(
  name: string,
  args: Record<string, unknown> | undefined,
): NormalizedToolCall {
  const alias = TOOL_ALIASES[name];
  if (!alias) {
    return { name, args: args ?? {} };
  }

  return {
    name: alias.name,
    args: { ...(args ?? {}), action: alias.action },
    deprecated:
      `Deprecated tool "${name}" is now ${alias.name} with action="${alias.action}". ` +
      'The legacy alias remains available during the v1.2 transition.',
  };
}
