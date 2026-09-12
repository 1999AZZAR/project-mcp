import {
  SERVER_NAME,
  TOOL_SIDE_EFFECTS,
  isEnvelopeEnabled,
  wrapResult,
  wrapError,
  textResult,
  errorResult,
} from '../src/envelope';

const ENVELOPE_KEYS = [
  'ok', 'summary', 'data', 'artifacts', 'provenance',
  'warnings', 'sideEffects', 'execution', 'redaction',
];

describe('genome envelope (P1-C1)', () => {
  const OLD_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...OLD_ENV };
  });

  test('flag off by default', () => {
    delete process.env['HELA_ENVELOPE'];
    expect(isEnvelopeEnabled()).toBe(false);
  });

  test('off-mode textResult is byte-identical legacy JSON', () => {
    delete process.env['HELA_ENVELOPE'];
    const payload = { success: true, data: { a: 1 } };
    const res: any = textResult('search_nodes', payload);
    expect(res.content[0].text).toBe(JSON.stringify(payload, null, 2));
  });

  test('off-mode errorResult preserves legacy shape', () => {
    delete process.env['HELA_ENVELOPE'];
    const res: any = errorResult('search_nodes', 'Tool execution failed: boom');
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toBe(
      JSON.stringify({ success: false, error: 'Tool execution failed: boom' }, null, 2),
    );
  });

  test('on-mode envelope carries all 9 canonical keys', () => {
    process.env['HELA_ENVELOPE'] = 'true';
    const res: any = textResult('search_nodes', { success: true });
    const env = JSON.parse(res.content[0].text);
    for (const k of ENVELOPE_KEYS) expect(env).toHaveProperty(k);
    expect(env.ok).toBe(true);
    expect(env.data).toEqual({ success: true });
    expect(env.execution.serverName).toBe(SERVER_NAME);
    expect(env.execution.toolName).toBe('search_nodes');
    expect(env.redaction).toEqual({ applied: false, fields: [] });
  });

  test('on-mode error envelope ok:false + error field', () => {
    process.env['HELA_ENVELOPE'] = 'true';
    const res: any = errorResult('delete_data', 'denied');
    expect(res.isError).toBe(true);
    const env = JSON.parse(res.content[0].text);
    expect(env.ok).toBe(false);
    expect(env.error).toBe('denied');
  });

  test('side-effect map: writes declare, reads empty', () => {
    expect(TOOL_SIDE_EFFECTS['add_observation']).toEqual(['memory-write']);
    expect(TOOL_SIDE_EFFECTS['delete_entity']).toEqual(['memory-delete']);
    expect(TOOL_SIDE_EFFECTS['execute_sql']).toEqual(['sql-statement']);
    expect(TOOL_SIDE_EFFECTS['insert_data']).toEqual(['data-write']);
    expect(TOOL_SIDE_EFFECTS['delete_data']).toEqual(['data-delete']);
    expect(TOOL_SIDE_EFFECTS['setup_pre_commit']).toEqual(['repo-write']);
    expect(TOOL_SIDE_EFFECTS['cache_set']).toEqual(['cache-write']);
    for (const t of ['search_nodes', 'read_graph', 'query_data', 'cache_get', 'get_session_context']) {
      expect(TOOL_SIDE_EFFECTS[t]).toEqual([]);
    }
  });

  test('run/step ids propagate from env', () => {
    process.env['HELA_ENVELOPE'] = 'true';
    process.env['HELA_RUN_ID'] = 'run-1';
    process.env['HELA_STEP_ID'] = 's3';
    const env = wrapResult('search_nodes', {});
    expect(env.execution.run_id).toBe('run-1');
    expect(env.execution.step_id).toBe('s3');
    const err = wrapError('search_nodes', 'x');
    expect(err.execution.run_id).toBe('run-1');
  });

  test('unknown tool defaults to empty side effects', () => {
    process.env['HELA_ENVELOPE'] = 'true';
    expect(wrapResult('nope_tool', {}).sideEffects).toEqual([]);
  });
});
