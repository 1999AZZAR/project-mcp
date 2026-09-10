import sqlite3 from 'sqlite3';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { redactSecrets, cleanObservations, truncate } from '../src/session-bridge/redact';
import { locateStores } from '../src/session-bridge/stores';
import {
  extractAntigravityConversations,
  extractCodexSessions,
  extractCursorSessions,
  extractDeltaThreads,
  extractDrizzleSessions,
  extractVscodeSessions,
  extractZedThreads,
} from '../src/session-bridge/extractors';
import { syncHarnessSessions } from '../src/session-bridge/sync';

function run(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params as never[], (err: Error | null) => (err ? reject(err) : resolve()));
  });
}

async function fixtureDb(path: string, setup: (db: sqlite3.Database) => Promise<void>): Promise<void> {
  const db = new sqlite3.Database(path);
  try {
    await setup(db);
  } finally {
    await new Promise<void>((resolve) => db.close(() => resolve()));
  }
}

describe('session-bridge/redact', () => {
  test('redacts known secret shapes', () => {
    expect(redactSecrets('key sk-or-v1-abcdefghijklmnop here')).toContain('[REDACTED]');
    expect(redactSecrets('token ghp_abcdefghijklmnop here')).toContain('[REDACTED]');
    expect(redactSecrets('Authorization: Bearer abcdefghijklmnop')).toContain('[REDACTED]');
    expect(redactSecrets('password=supersecret123')).toContain('[REDACTED]');
    expect(redactSecrets('-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----')).toContain('[REDACTED]');
  });

  test('leaves clean text alone and truncates', () => {
    expect(redactSecrets('fixed the login bug')).toBe('fixed the login bug');
    expect(truncate('a'.repeat(600), 500).length).toBeLessThanOrEqual(501);
  });

  test('dedups and caps observations', () => {
    const out = cleanObservations(['hi', 'hi', 'x', 'a proper observation here']);
    expect(out).toEqual(['a proper observation here']);
  });
});

describe('session-bridge/stores', () => {
  const OLD = { ...process.env };
  afterEach(() => {
    process.env = { ...OLD };
  });

  test('env overrides are honored and missing stores report found=false', () => {
    process.env.HARNESS_OPENCODE_PATH = '/nonexistent/opencode.db';
    process.env.HARNESS_CODEX_PATH = '/nonexistent/codex';
    const stores = locateStores();
    expect(stores).toHaveLength(8);
    expect(stores.map((s) => s.harness)).toEqual(
      expect.arrayContaining(['opencode', 'kilocode', 'zed', 'delta', 'antigravity', 'cursor', 'vscode', 'codex']),
    );
    const oc = stores.find((s) => s.harness === 'opencode');
    expect(oc?.found).toBe(false);
    expect(oc?.path).toBe('/nonexistent/opencode.db');
  });
});

describe('session-bridge/extractors', () => {
  let dir: string;
  const OLD = { ...process.env };

  beforeEach(() => {
    dir = join(tmpdir(), `bridge-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(dir, { recursive: true });
  });

  afterEach(() => {
    process.env = { ...OLD };
    rmSync(dir, { recursive: true, force: true });
  });

  test('drizzle reader normalizes sessions, counts messages, skips archived by default', async () => {
    const dbPath = join(dir, 'opencode.db');
    await fixtureDb(dbPath, async (db) => {
      await run(db, 'CREATE TABLE session (id TEXT PRIMARY KEY, directory TEXT, title TEXT, time_created INTEGER, time_updated INTEGER, time_archived INTEGER, model TEXT, summary_diffs TEXT)');
      await run(db, 'CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT, time_created INTEGER, data TEXT)');
      await run(db, `INSERT INTO session VALUES ('s1','/proj/a','Fix login',1000,2000,NULL,'{"id":"m1"}','a|b')`);
      await run(db, `INSERT INTO session VALUES ('s2','/proj/a','Old work',1000,1500,1600,'{"id":"m1"}',NULL)`);
      await run(db, `INSERT INTO message VALUES ('m1','s1',1100,'{"role":"user","content":[{"type":"text","text":"please fix login"}]}')`);
      await run(db, `INSERT INTO message VALUES ('m2','s1',1200,'{"role":"assistant","content":"done"}')`);
    });
    const rows = await extractDrizzleSessions('opencode', dbPath, {});
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ sessionId: 's1', project: '/proj/a', title: 'Fix login', messageCount: 2, model: 'm1' });
    expect(rows[0]?.summary).toContain('please fix login');
    const withArchived = await extractDrizzleSessions('opencode', dbPath, { includeArchived: true });
    expect(withArchived).toHaveLength(2);
  });

  test('zed threads reader uses summaries', async () => {
    const dbPath = join(dir, 'threads.db');
    await fixtureDb(dbPath, async (db) => {
      await run(db, 'CREATE TABLE threads (id TEXT PRIMARY KEY, summary TEXT, updated_at TEXT, data BLOB)');
      await run(db, `INSERT INTO threads VALUES ('t1','Refactor auth module','2026-09-01T10:00:00Z','blob')`);
    });
    const rows = await extractZedThreads(dbPath, {});
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ harness: 'zed', sessionId: 't1' });
    expect(rows[0]?.title).toContain('Refactor auth');
  });

  test('delta threads reader honors archived flag', async () => {
    const dbPath = join(dir, 'data.sqlite');
    await fixtureDb(dbPath, async (db) => {
      await run(db, 'CREATE TABLE app_threads (id TEXT PRIMARY KEY, name TEXT, created_at INTEGER, last_prompted_at INTEGER, status TEXT, archived INTEGER)');
      await run(db, `INSERT INTO app_threads VALUES ('d1','Ship it',1700000000000,1700000001000,'active',0)`);
      await run(db, `INSERT INTO app_threads VALUES ('d2','Old',1700000000000,1700000001000,'done',1)`);
    });
    expect(await extractDeltaThreads(dbPath, {})).toHaveLength(1);
    expect(await extractDeltaThreads(dbPath, { includeArchived: true })).toHaveLength(2);
  });

  test('antigravity summaries map rich rows', async () => {
    const dbPath = join(dir, 'summaries.db');
    await fixtureDb(dbPath, async (db) => {
      await run(
        db,
        'CREATE TABLE conversation_summaries (conversation_id TEXT PRIMARY KEY, title TEXT, preview TEXT, step_count INTEGER, last_modified_time TEXT, workspace_uris TEXT, status TEXT, agent_name TEXT, project_id TEXT)',
      );
      await run(
        db,
        `INSERT INTO conversation_summaries VALUES ('c1','Deploy pipeline','Deployed to staging',12,'2026-09-02 10:00:00','["/home/u/proj"]','done','agent-x','proj-9')`,
      );
    });
    const rows = await extractAntigravityConversations(dbPath, {});
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ harness: 'antigravity', sessionId: 'c1', project: 'proj-9', messageCount: 12 });
    expect(rows[0]?.summary).toContain('Deployed to staging');
  });

  test('codex rollout jsonl parses meta + first user text (real shapes)', async () => {
    const root = join(dir, 'codex');
    mkdirSync(join(root, 'sessions', '2026', '09', '10'), { recursive: true });
    writeFileSync(
      join(root, 'sessions', '2026', '09', '10', 'rollout-2026-09-10T10-00-00-abc123.jsonl'),
      [
        JSON.stringify({ type: 'session_meta', payload: { id: 'abc123', cwd: '/home/u/proj', model_provider: 'openai' } }),
        JSON.stringify({ type: 'event_msg', payload: { type: 'user_message', message: 'add dark mode' } }),
        JSON.stringify({ type: 'response_item', payload: { role: 'assistant', content: [{ type: 'output_text', text: 'on it' }] } }),
      ].join('\n'),
    );
    const rows = await extractCodexSessions(root, {});
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ harness: 'codex', sessionId: 'abc123', project: '/home/u/proj', messageCount: 2, model: 'openai' });
    expect(rows[0]?.title).toContain('dark mode');
  });

  test('codex skips slash-command noise for titles', async () => {
    const root = join(dir, 'codex2');
    mkdirSync(join(root, 'sessions', '2026', '09', '10'), { recursive: true });
    writeFileSync(
      join(root, 'sessions', '2026', '09', '10', 'rollout-x.jsonl'),
      [
        JSON.stringify({ type: 'session_meta', payload: { id: 'x1', cwd: '/home/u' } }),
        JSON.stringify({ type: 'event_msg', payload: { type: 'user_message', message: '<command-name>/model</command-name>' } }),
        JSON.stringify({ type: 'event_msg', payload: { type: 'user_message', message: 'refactor the router' } }),
      ].join('\n'),
    );
    const rows = await extractCodexSessions(root, {});
    expect(rows[0]?.title).toContain('refactor the router');
  });

  test('cursor reports honest notes when absent or unparseable', async () => {
    const missing = await extractCursorSessions(join(dir, 'nope'), {});
    expect(missing.sessions).toHaveLength(0);
    expect(missing.note).toBeDefined();
  });

  test('cursor parses composer state.vscdb fixture', async () => {
    const ws = join(dir, 'ws', 'abc');
    mkdirSync(ws, { recursive: true });
    await fixtureDb(join(ws, 'state.vscdb'), async (db) => {
      await run(db, 'CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value TEXT)');
      await run(
        db,
        `INSERT INTO ItemTable VALUES ('composer.composerData', '{"conversation":[{"id":"cc1","title":"Refactor API","updatedAt":1789000000000}]}')`,
      );
    });
    const { sessions } = await extractCursorSessions(join(dir, 'ws'), {});
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({ harness: 'cursor', sessionId: 'cc1' });
  });

  test('vscode locator is honest when absent', async () => {
    const r = await extractVscodeSessions(join(dir, 'nope'));
    expect(r.sessions).toHaveLength(0);
    expect(r.note).toBeDefined();
  });
});

describe('session-bridge/sync', () => {
  test('real sync creates once (redacted), second run skips via watermarks', async () => {
    const dir = join(tmpdir(), `bridge-sync-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    const OLD = { ...process.env };
    try {
      const dbPath = join(dir, 'threads.db');
      const db = new sqlite3.Database(dbPath);
      await new Promise<void>((resolve, reject) => {
        db.run('CREATE TABLE threads (id TEXT PRIMARY KEY, summary TEXT, updated_at TEXT, data BLOB)', (e: Error | null) => (e ? reject(e) : resolve()));
      });
      await new Promise<void>((resolve, reject) => {
        db.run(
          `INSERT INTO threads VALUES ('t1','Ship feature with key sk-or-v1-abcdefghijklmnop inside','2026-09-05T10:00:00Z','x')`,
          (e: Error | null) => (e ? reject(e) : resolve()),
        );
      });
      await new Promise<void>((resolve) => db.close(() => resolve()));
      process.env.HARNESS_ZED_PATH = dbPath;

      const { syncHarnessSessions } = await import('../src/session-bridge/sync');
      const created: Array<{ name: string; entityType: string; observations: string[] }> = [];
      const added: Array<{ entityName: string; contents: string[] }> = [];
      const watermarks = new Map<string, number>();
      const memory = {
        openNodes: async (names: string[]) =>
          created.filter((c) => names.includes(c.name)).map((c) => ({ name: c.name })),
        createEntity: async (name: string, entityType: string, observations: string[]) => {
          created.push({ name, entityType, observations });
          return { name };
        },
        addObservation: async (entityName: string, contents: string[]) => {
          added.push({ entityName, contents });
          return { name: entityName };
        },
      };
      const sqlite = {
        executeSql: async (_db: string, sql: string, params: unknown[] = []) => {
          if (sql.startsWith('CREATE TABLE')) return { rows: [] };
          if (sql.startsWith('SELECT')) {
            const h = params[0] as string;
            return {
              rows: [...watermarks.entries()]
                .filter(([k]) => k.startsWith(`${h}:`))
                .map(([k, v]) => ({ session_id: k.slice(h.length + 1), synced_updated: v })),
            };
          }
          const [h, sid, ts] = params as [string, string, number];
          watermarks.set(`${h}:${sid}`, ts);
          return { rows: [] };
        },
      };

      const first = await syncHarnessSessions(sqlite as never, memory as never, { harnesses: ['zed'] });
      const zed = first.find((r) => r.harness === 'zed');
      expect(zed?.created).toBe(1);
      expect(created[0]?.name).toBe('harness:zed:t1');
      expect(created[0]?.entityType).toBe('session');
      expect(JSON.stringify(created[0]?.observations)).not.toContain('sk-or-v1-abcdefghijklmnop');
      expect(JSON.stringify(created[0]?.observations)).toContain('[REDACTED]');

      const second = await syncHarnessSessions(sqlite as never, memory as never, { harnesses: ['zed'] });
      const zed2 = second.find((r) => r.harness === 'zed');
      expect(zed2?.skipped).toBe(1);
      expect(zed2?.created).toBe(0);
      expect(created).toHaveLength(1);
    } finally {
      process.env = { ...OLD };
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('syncHarnessSessions dry-run lists without writing (fixture db)', async () => {
    const dir = join(tmpdir(), `bridge-sync-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    try {
      const dbPath = join(dir, 'threads.db');
      const db = new sqlite3.Database(dbPath);
      await new Promise<void>((resolve, reject) => {
        db.run('CREATE TABLE threads (id TEXT PRIMARY KEY, summary TEXT, updated_at TEXT, data BLOB)', (e: Error | null) => (e ? reject(e) : resolve()));
      });
      await new Promise<void>((resolve, reject) => {
        db.run(`INSERT INTO threads VALUES ('t9','Sync me please','2026-09-05T10:00:00Z','x')`, (e: Error | null) => (e ? reject(e) : resolve()));
      });
      await new Promise<void>((resolve) => db.close(() => resolve()));
      process.env.HARNESS_ZED_PATH = dbPath;
      const { syncHarnessSessions } = await import('../src/session-bridge/sync');
      const writes: string[] = [];
      const memory = {
        openNodes: async () => [],
        createEntity: async (name: string) => {
          writes.push(name);
          return { name };
        },
        addObservation: async (name: string) => {
          writes.push(name);
          return { name };
        },
      };
      const sqlite = { executeSql: async () => ({ rows: [] }) };
      const results = await syncHarnessSessions(sqlite as never, memory as never, {
        harnesses: ['zed'],
        dryRun: true,
      });
      const zed = results.find((r) => r.harness === 'zed');
      expect(zed?.found).toBe(true);
      expect(zed?.scanned).toBe(1);
      expect(writes).toHaveLength(0);
      expect(zed?.sessions?.[0]?.action).toBe('dry-run');
    } finally {
      delete process.env.HARNESS_ZED_PATH;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
