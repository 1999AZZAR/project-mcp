import sqlite3 from 'sqlite3';
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import type { HarnessSession } from './types.js';

const BUSY_TIMEOUT_MS = 2000;
const MAX_TEXT_CHARS = 1200;

function openReadOnly(path: string): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(path, sqlite3.OPEN_READONLY, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

function all<T = Record<string, unknown>>(db: sqlite3.Database, sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    try {
      db.configure('busyTimeout', BUSY_TIMEOUT_MS);
    } catch {
      /* best effort */
    }
    db.all(sql, params as never[], (err: Error | null, rows: T[]) => {
      if (err) reject(err);
      else resolve(rows ?? []);
    });
  });
}

function closeQuiet(db: sqlite3.Database): Promise<void> {
  return new Promise((resolve) => db.close(() => resolve()));
}

function toMs(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Date.parse(v)) && /[-T:/]/.test(v) ? Date.parse(v) : Number(v);
  if (!Number.isFinite(n) || n <= 0) return Date.now();
  return n < 1e12 ? Math.floor(n * 1000) : Math.floor(n);
}

function clip(s: string, max: number = MAX_TEXT_CHARS): string {
  const c = s.replace(/\s+/g, ' ').trim();
  return c.length > max ? c.slice(0, max) + '…' : c;
}

function isCommandNoise(t: string): boolean {
  const s = t.trimStart();
  return s.startsWith('<command-name>') || s.startsWith('<local-command-stdout>');
}

function contentText(content: unknown): string | undefined {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const texts = content
      .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
      .filter(
        (p) =>
          (p['type'] === 'input_text' || p['type'] === 'text' || p['type'] === 'output_text') &&
          typeof p['text'] === 'string',
      )
      .map((p) => String(p['text']));
    return texts.length ? texts.join('\n') : undefined;
  }
  return undefined;
}

/** Codex rollout shapes: event_msg/user_message, response_item roles, plus legacy role/content. */
function codexRole(ev: Record<string, unknown>): 'user' | 'assistant' | undefined {
  if (ev['role'] === 'user' || ev['role'] === 'assistant') return ev['role'];
  const payload = ev['payload'];
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    if (p['role'] === 'user' || p['role'] === 'assistant') return p['role'];
    if (p['type'] === 'user_message') return 'user';
    if (p['type'] === 'agent_message') return 'assistant';
  }
  const t = ev['type'];
  if (t === 'user' || t === 'assistant') return t;
  return undefined;
}

function codexText(ev: Record<string, unknown>): string | undefined {
  const direct = contentText(ev['content'] ?? ev['text']);
  if (direct) return direct;
  const payload = ev['payload'];
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    if (typeof p['message'] === 'string') return p['message'];
    const t = contentText(p['content'] ?? p['text']);
    if (t) return t;
  }
  return undefined;
}

function firstUserText(dataRaw: unknown): string | undefined {
  try {
    const data = typeof dataRaw === 'string' ? JSON.parse(dataRaw) : dataRaw;
    if (!data || typeof data !== 'object') return undefined;
    const rec = data as Record<string, unknown>;
    if (rec['role'] !== 'user') return undefined;
    const t = contentText(rec['content']);
    return t ? clip(t, 300) : undefined;
  } catch {
    return undefined;
  }
}

export interface ExtractOptions {
  limit?: number;
  since?: number;
  project?: string;
  includeArchived?: boolean;
}

function matchProject(project: string | undefined, filter?: string): boolean {
  if (!filter) return true;
  if (!project) return false;
  return project.toLowerCase().includes(filter.toLowerCase());
}

/** opencode + kilocode share the Drizzle session/message/part schema. */
export async function extractDrizzleSessions(
  harness: 'opencode' | 'kilocode',
  dbPath: string,
  opts: ExtractOptions = {},
): Promise<HarnessSession[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
  const db = await openReadOnly(dbPath);
  try {
    const rows = await all<Record<string, unknown>>(
      db,
      `SELECT id, directory, title, time_created, time_updated, time_archived, model, summary_diffs
       FROM session ORDER BY time_updated DESC LIMIT ?`,
      [limit * 2],
    );
    const out: HarnessSession[] = [];
    for (const r of rows) {
      if (typeof r['id'] !== 'string') continue;
      const updatedAt = toMs(r['time_updated']);
      if (opts.since && updatedAt <= opts.since) continue;
      const archived = r['time_archived'] != null;
      if (archived && !opts.includeArchived) continue;
      const project = typeof r['directory'] === 'string' ? r['directory'] : undefined;
      if (!matchProject(project, opts.project)) continue;
      let model: string | undefined;
      try {
        const m = typeof r['model'] === 'string' ? JSON.parse(r['model']) : r['model'];
        if (m && typeof m === 'object') model = String((m as Record<string, unknown>)['id'] ?? '');
      } catch {
        model = typeof r['model'] === 'string' ? r['model'] : undefined;
      }
      const counts = await all<{ n: number }>(
        db,
        'SELECT COUNT(*) AS n FROM message WHERE session_id = ?',
        [r['id']],
      );
      const first = await all<{ data: unknown }>(
        db,
        `SELECT data FROM message WHERE session_id = ? ORDER BY time_created ASC LIMIT 8`,
        [r['id']],
      );
      let firstText: string | undefined;
      for (const m of first) {
        const t = firstUserText(m.data);
        if (t) {
          firstText = t;
          break;
        }
      }
      const diffs = typeof r['summary_diffs'] === 'string' ? clip(r['summary_diffs'], 400) : undefined;
      out.push({
        harness,
        sessionId: r['id'],
        project,
        title: typeof r['title'] === 'string' && r['title'] ? r['title'] : '(untitled session)',
        summary: [firstText, diffs].filter(Boolean).join(' | ') || undefined,
        updatedAt,
        messageCount: counts[0]?.n ?? 0,
        model: model || undefined,
        archived,
      });
      if (out.length >= limit) break;
    }
    return out;
  } finally {
    await closeQuiet(db);
  }
}

export async function extractZedThreads(dbPath: string, opts: ExtractOptions = {}): Promise<HarnessSession[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const db = await openReadOnly(dbPath);
  try {
    const rows = await all<Record<string, unknown>>(
      db,
      'SELECT id, summary, updated_at, data FROM threads ORDER BY updated_at DESC LIMIT ?',
      [limit],
    );
    const out: HarnessSession[] = [];
    for (const r of rows) {
      if (typeof r['id'] !== 'string') continue;
      const updatedAt = toMs(r['updated_at']);
      if (opts.since && updatedAt <= opts.since) continue;
      const summary = typeof r['summary'] === 'string' ? r['summary'] : undefined;
      if (opts.project && summary && !matchProject(summary, opts.project)) continue;
      let snippet: string | undefined;
      const blob = r['data'];
      if (blob && (typeof blob === 'string' || Buffer.isBuffer(blob))) {
        try {
          const text = (typeof blob === 'string' ? blob : (blob as Buffer).toString('utf8')).slice(0, 600);
          snippet = clip(text, 300);
        } catch {
          snippet = undefined;
        }
      }
      out.push({
        harness: 'zed',
        sessionId: r['id'],
        title: summary ? clip(summary, 120) : '(zed thread)',
        summary: [summary ? clip(summary, 400) : undefined, snippet].filter(Boolean).join(' | ') || undefined,
        updatedAt,
      });
    }
    return out;
  } finally {
    await closeQuiet(db);
  }
}

export async function extractDeltaThreads(dbPath: string, opts: ExtractOptions = {}): Promise<HarnessSession[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const db = await openReadOnly(dbPath);
  try {
    const rows = await all<Record<string, unknown>>(
      db,
      `SELECT id, name, created_at, last_prompted_at, status, archived
       FROM app_threads ORDER BY COALESCE(last_prompted_at, created_at) DESC LIMIT ?`,
      [limit],
    );
    const out: HarnessSession[] = [];
    for (const r of rows) {
      if (typeof r['id'] !== 'string') continue;
      const updatedAt = toMs(r['last_prompted_at'] ?? r['created_at']);
      if (opts.since && updatedAt <= opts.since) continue;
      const archived = Number(r['archived'] ?? 0) !== 0;
      if (archived && !opts.includeArchived) continue;
      const name = typeof r['name'] === 'string' && r['name'] ? r['name'] : '(delta thread)';
      if (!matchProject(name, opts.project)) continue;
      out.push({
        harness: 'delta',
        sessionId: r['id'],
        title: clip(name, 120),
        summary: typeof r['status'] === 'string' && r['status'] ? `status: ${clip(r['status'], 200)}` : undefined,
        updatedAt,
        archived,
      });
    }
    return out;
  } finally {
    await closeQuiet(db);
  }
}

export async function extractAntigravityConversations(dbPath: string, opts: ExtractOptions = {}): Promise<HarnessSession[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const db = await openReadOnly(dbPath);
  try {
    const rows = await all<Record<string, unknown>>(
      db,
      `SELECT conversation_id, title, preview, step_count, last_modified_time,
              workspace_uris, status, agent_name, project_id
       FROM conversation_summaries ORDER BY last_modified_time DESC LIMIT ?`,
      [limit],
    );
    const out: HarnessSession[] = [];
    for (const r of rows) {
      if (typeof r['conversation_id'] !== 'string') continue;
      const updatedAt = toMs(r['last_modified_time']);
      if (opts.since && updatedAt <= opts.since) continue;
      let project: string | undefined;
      if (typeof r['project_id'] === 'string' && r['project_id']) project = r['project_id'];
      else if (typeof r['workspace_uris'] === 'string' && r['workspace_uris']) {
        try {
          const uris = JSON.parse(r['workspace_uris']) as unknown;
          if (Array.isArray(uris) && typeof uris[0] === 'string') project = basename(String(uris[0]).replace(/\/$/, ''));
          else project = clip(r['workspace_uris'], 120);
        } catch {
          project = clip(r['workspace_uris'], 120);
        }
      }
      if (!matchProject(project, opts.project)) continue;
      const title = typeof r['title'] === 'string' && r['title'] ? r['title'] : '(antigravity conversation)';
      const preview = typeof r['preview'] === 'string' && r['preview'] ? clip(r['preview'], 500) : undefined;
      const agent = typeof r['agent_name'] === 'string' && r['agent_name'] ? r['agent_name'] : undefined;
      out.push({
        harness: 'antigravity',
        sessionId: r['conversation_id'],
        project,
        title: clip(title, 140),
        summary: [preview, agent ? `agent: ${agent}` : undefined].filter(Boolean).join(' | ') || undefined,
        updatedAt,
        messageCount: typeof r['step_count'] === 'number' ? r['step_count'] : undefined,
      });
    }
    return out;
  } finally {
    await closeQuiet(db);
  }
}

interface CodexFile {
  path: string;
  mtime: number;
  archived: boolean;
}

function collectCodexFiles(root: string, maxFiles: number): CodexFile[] {
  const found: CodexFile[] = [];
  const walk = (dir: string, archived: boolean) => {
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const e of entries) {
      if (found.length >= maxFiles) return;
      const full = join(dir, e);
      try {
        const st = statSync(full);
        if (st.isDirectory()) {
          walk(full, archived || basename(dir) === 'archived_sessions' || e === 'archived_sessions');
        } else if (e.startsWith('rollout-') && e.endsWith('.jsonl')) {
          found.push({ path: full, mtime: st.mtimeMs, archived });
        }
      } catch {
        continue;
      }
    }
  };
  for (const sub of ['sessions', 'archived_sessions']) {
    walk(join(root, sub), sub === 'archived_sessions');
  }
  found.sort((a, b) => b.mtime - a.mtime);
  return found.slice(0, maxFiles);
}

export async function extractCodexSessions(
  codexDir: string,
  opts: ExtractOptions & { maxFiles?: number; maxLinesPerFile?: number } = {},
): Promise<HarnessSession[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const files = collectCodexFiles(codexDir, 300);
  const out: HarnessSession[] = [];
  const maxLines = Math.min(Math.max(opts.maxLinesPerFile ?? 400, 50), 2000);
  for (const f of files) {
    if (out.length >= limit) break;
    if (opts.since && f.mtime <= opts.since) continue;
    if (f.archived && !opts.includeArchived) continue;
    let meta: Record<string, unknown> | undefined;
    let firstUser: string | undefined;
    let firstUserFallback: string | undefined;
    let userCount = 0;
    let assistantCount = 0;
    try {
      const text = readFileSync(f.path, 'utf8');
      const lines = text.split('\n');
      for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
        const line = lines[i].trim();
        if (!line) continue;
        let ev: Record<string, unknown>;
        try {
          ev = JSON.parse(line) as Record<string, unknown>;
        } catch {
          continue;
        }
        if (ev['type'] === 'session_meta') {
          const payload = ev['payload'];
          if (payload && typeof payload === 'object') meta = payload as Record<string, unknown>;
          continue;
        }
        const role = codexRole(ev);
        if (role === 'user') {
          userCount++;
          const t = codexText(ev);
          if (t) {
            if (!firstUserFallback) firstUserFallback = clip(t, 300);
            if (!firstUser && !isCommandNoise(t)) firstUser = clip(t, 300);
          }
        } else if (role === 'assistant') {
          assistantCount++;
        }
      }
    } catch {
      continue;
    }
    const metaId = meta && typeof meta['id'] === 'string' ? (meta['id'] as string) : undefined;
    const cwd = meta && typeof meta['cwd'] === 'string' ? (meta['cwd'] as string) : undefined;
    const model =
      meta && typeof meta['model'] === 'string'
        ? (meta['model'] as string)
        : meta && typeof meta['model_provider'] === 'string'
          ? (meta['model_provider'] as string)
          : undefined;
    const title = firstUser ?? firstUserFallback ?? '(codex session)';
    if (opts.project && !matchProject(cwd, opts.project) && !matchProject(title, opts.project)) continue;
    out.push({
      harness: 'codex',
      sessionId: metaId ?? basename(f.path).replace(/^rollout-/, '').replace(/\.jsonl$/, ''),
      project: cwd,
      title,
      updatedAt: Math.floor(f.mtime),
      messageCount: userCount + assistantCount,
      model,
      archived: f.archived,
    });
  }
  return out;
}

/** Best-effort Cursor composer reader. Returns [] with note when absent/unparseable. */
export async function extractCursorSessions(
  workspaceStorageDir: string,
  opts: ExtractOptions = {},
): Promise<{ sessions: HarnessSession[]; note?: string }> {
  let dirs: string[] = [];
  try {
    dirs = readdirSync(workspaceStorageDir);
  } catch {
    return { sessions: [], note: 'cursor workspace storage not found' };
  }
  const out: HarnessSession[] = [];
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  let sawDb = false;
  for (const d of dirs) {
    if (out.length >= limit) break;
    const dbPath = join(workspaceStorageDir, d, 'state.vscdb');
    if (!existsSync(dbPath)) continue;
    sawDb = true;
    let db: sqlite3.Database | null = null;
    try {
      db = await openReadOnly(dbPath);
      const rows = await all<{ value: unknown }>(db, `SELECT value FROM ItemTable WHERE key = 'composer.composerData' LIMIT 1`);
      if (!rows.length) continue;
      const raw = rows[0]?.value;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const conv = (parsed as Record<string, unknown>)?.['conversation'];
      const items = Array.isArray(conv) ? conv : (parsed as Record<string, unknown>)?.['conversations'];
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        if (out.length >= limit) break;
        if (!item || typeof item !== 'object') continue;
        const rec = item as Record<string, unknown>;
        const id = typeof rec['id'] === 'string' ? rec['id'] : typeof rec['conversationId'] === 'string' ? String(rec['conversationId']) : undefined;
        if (!id) continue;
        const title = typeof rec['title'] === 'string' && rec['title'] ? clip(rec['title'], 140) : '(cursor composer)';
        const updatedAt = toMs(rec['updatedAt'] ?? rec['lastUpdated'] ?? Date.now());
        if (opts.since && updatedAt <= opts.since) continue;
        out.push({ harness: 'cursor', sessionId: id, title, updatedAt });
      }
    } catch {
      continue;
    } finally {
      if (db) await closeQuiet(db);
    }
  }
  if (!sawDb) return { sessions: [], note: 'no cursor state.vscdb files found' };
  if (!out.length) return { sessions: [], note: 'cursor state present but no parseable composer data' };
  return { sessions: out };
}

/** VS Code: locator-level support only; Copilot chat has no stable local schema to parse. */
export async function extractVscodeSessions(
  workspaceStorageDir: string,
): Promise<{ sessions: HarnessSession[]; note?: string }> {
  let exists = false;
  try {
    exists = existsSync(workspaceStorageDir);
  } catch {
    exists = false;
  }
  if (!exists) return { sessions: [], note: 'vscode workspace storage not found' };
  return { sessions: [], note: 'vscode chat storage has no stable local schema; locator only' };
}
