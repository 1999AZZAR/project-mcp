/**
 * C1 provider-side HeLaResult envelope (self-contained mirror of the canonical
 * shape in chaining-mcp/src/agent/hela-result.ts; this repo is a standalone
 * package and must not import across repos).
 *
 * Flag-gated: set HELA_ENVELOPE=true to wrap tool payloads in the canonical
 * HelaResult envelope. Default (unset/anything else) returns the legacy raw
 * payload byte-for-byte identical to before.
 */

export interface HelaArtifactRef {
  uri: string;
  sha256?: string;
  size?: number;
  media_type?: string;
}

export interface HelaProvenanceRef {
  source: string;
  retrieved_at?: string;
  confidence?: number;
  freshness?: string;
}

export interface HelaRedaction {
  applied: boolean;
  fields: string[];
}

export interface HelaExecutionMeta {
  serverName?: string;
  toolName?: string;
  run_id?: string;
  step_id?: string;
  attempt?: number;
  executionTimeMs?: number;
  startedAt?: string;
  completedAt?: string;
}

export interface HelaResult<T = unknown> {
  ok: boolean;
  summary: string;
  /** Canonical payload field. */
  data: T;
  artifacts: HelaArtifactRef[];
  provenance: HelaProvenanceRef[];
  warnings: string[];
  sideEffects: string[];
  execution: HelaExecutionMeta;
  redaction: HelaRedaction;
  error?: string;
}

export const SERVER_NAME = 'project-guardian-mcp';

/** Consequential tools declare their side effects; reads declare none. */
export const TOOL_SIDE_EFFECTS: Record<string, string[]> = {
  // memory graph
  create_entity: ['memory-write'],
  create_relation: ['memory-write'],
  add_observation: ['memory-write'],
  delete_entity: ['memory-delete'],
  delete_observation: ['memory-delete'],
  delete_relation: ['memory-delete'],
  read_graph: [],
  read_graph_stream: [],
  search_nodes: [],
  open_node: [],
  initialize_memory: ['memory-write'],
  sync_central_memory: ['memory-write'],
  sync_harness_sessions: ['memory-write'],
  list_harness_stores: [],
  get_session_context: [],
  // database tools
  execute_sql: ['sql-statement'],
  query_data: [],
  insert_data: ['data-write'],
  update_data: ['data-write'],
  delete_data: ['data-delete'],
  import_data: ['data-write'],
  export_data: [],
  // runtime companions (read-only scans)
  analyze_git_changes: [],
  inspect_untrusted_text: [],
  scan_project_secrets: [],
  scan_container_image: [],
  // cache companions
  cache_get: [],
  cache_scan: [],
  cache_set: ['cache-write'],
  cache_delete: ['cache-write'],
  // misc
  get_project_guidance: [],
  set_project_root: ['config-change'],
  setup_pre_commit: ['repo-write'],
  start_ui: ['process-lifecycle'],
  close_ui: ['process-lifecycle'],
  stop_ui: ['process-lifecycle'],
};

export function isEnvelopeEnabled(): boolean {
  return process.env['HELA_ENVELOPE'] === 'true';
}

function baseExecution(toolName: string): HelaExecutionMeta {
  const runId = process.env['HELA_RUN_ID'];
  const stepId = process.env['HELA_STEP_ID'];
  return {
    serverName: SERVER_NAME,
    toolName,
    ...(runId !== undefined ? { run_id: runId } : {}),
    ...(stepId !== undefined ? { step_id: stepId } : {}),
    completedAt: new Date().toISOString(),
  };
}

export function wrapResult<T>(toolName: string, data: T, summary?: string): HelaResult<T> {
  return {
    ok: true,
    summary: summary || `${toolName} ok`,
    data,
    artifacts: [],
    provenance: [],
    warnings: [],
    sideEffects: TOOL_SIDE_EFFECTS[toolName] || [],
    execution: baseExecution(toolName),
    redaction: { applied: false, fields: [] },
  };
}

export function wrapError(toolName: string, message: string): HelaResult<null> {
  return {
    ok: false,
    summary: `${toolName} failed: ${message}`,
    data: null,
    artifacts: [],
    provenance: [],
    warnings: [],
    sideEffects: TOOL_SIDE_EFFECTS[toolName] || [],
    execution: baseExecution(toolName),
    redaction: { applied: false, fields: [] },
    error: message,
  };
}

function textBlock(text: string): { content: Array<{ type: string; text: string }> } {
  return { content: [{ type: 'text', text }] };
}

/**
 * MCP tool-result responder. Envelope off (default): legacy raw JSON text,
 * byte-identical to the pre-C1 choke point (`JSON.stringify(result, null, 2)`).
 */
export function textResult<T>(toolName: string, data: T, summary?: string) {
  if (!isEnvelopeEnabled()) return textBlock(JSON.stringify(data, null, 2));
  return textBlock(JSON.stringify(wrapResult(toolName, data, summary), null, 2));
}

/**
 * MCP error responder. Envelope off (default): legacy shape preserved exactly
 * (`{success:false, error}` as JSON text + isError). Envelope on: proper
 * HelaResult with ok:false.
 */
export function errorResult(toolName: string, message: string) {
  if (!isEnvelopeEnabled()) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: false, error: message }, null, 2),
      }],
      isError: true,
    };
  }
  return {
    ...textBlock(JSON.stringify(wrapError(toolName, message), null, 2)),
    isError: true,
  };
}
