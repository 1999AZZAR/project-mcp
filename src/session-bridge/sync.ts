import type { MemoryManager } from '../memory-manager.js';
import type { SQLiteManager } from '../sqlite-manager.js';
import type { HarnessId, HarnessSession, SyncOptions, SyncResult } from './types.js';
import { locateStores } from './stores.js';
import {
  extractAntigravityConversations,
  extractCodexSessions,
  extractCursorSessions,
  extractDeltaThreads,
  extractDrizzleSessions,
  extractVscodeSessions,
  extractZedThreads,
} from './extractors.js';
import { cleanObservations } from './redact.js';

const WATERMARK_TABLE = 'harness_sync';

async function ensureWatermarkTable(sqlite: SQLiteManager): Promise<void> {
  await sqlite.executeSql(
    'memory',
    `CREATE TABLE IF NOT EXISTS ${WATERMARK_TABLE} (
       harness TEXT NOT NULL,
       session_id TEXT NOT NULL,
       synced_updated INTEGER NOT NULL,
       PRIMARY KEY (harness, session_id)
     )`,
  );
}

async function loadWatermarks(sqlite: SQLiteManager, harness: HarnessId): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const res = await sqlite.executeSql('memory', `SELECT session_id, synced_updated FROM ${WATERMARK_TABLE} WHERE harness = ?`, [harness]);
    const rows = (res as unknown as { rows?: Array<{ session_id: string; synced_updated: number }> }).rows ?? [];
    for (const r of rows) {
      if (typeof r.session_id === 'string') map.set(r.session_id, Number(r.synced_updated) || 0);
    }
  } catch {
    /* table may not exist yet on first run */
  }
  return map;
}

async function saveWatermark(sqlite: SQLiteManager, harness: HarnessId, sessionId: string, updatedAt: number): Promise<void> {
  await sqlite.executeSql(
    'memory',
    `INSERT INTO ${WATERMARK_TABLE} (harness, session_id, synced_updated) VALUES (?, ?, ?)
     ON CONFLICT(harness, session_id) DO UPDATE SET synced_updated = excluded.synced_updated`,
    [harness, sessionId, Math.floor(updatedAt)],
  );
}

function entityName(s: HarnessSession): string {
  return `harness:${s.harness}:${s.sessionId}`;
}

function sessionObservations(s: HarnessSession): string[] {
  const lines: string[] = [`[${s.harness}] ${s.title}`];
  if (s.project) lines.push(`project: ${s.project}`);
  if (s.summary) lines.push(s.summary);
  const meta: string[] = [];
  if (s.model) meta.push(`model: ${s.model}`);
  if (typeof s.messageCount === 'number') meta.push(`messages: ${s.messageCount}`);
  if (s.archived) meta.push('archived: true');
  meta.push(`updated: ${new Date(s.updatedAt).toISOString()}`);
  lines.push(meta.join(' | '));
  return cleanObservations(lines);
}

async function extractFor(
  harness: HarnessId,
  path: string,
  opts: { limit: number; since?: number; project?: string; includeArchived: boolean },
): Promise<{ sessions: HarnessSession[]; note?: string }> {
  switch (harness) {
    case 'opencode':
      return { sessions: await extractDrizzleSessions('opencode', path, opts) };
    case 'kilocode':
      return { sessions: await extractDrizzleSessions('kilocode', path, opts) };
    case 'zed':
      return { sessions: await extractZedThreads(path, opts) };
    case 'delta':
      return { sessions: await extractDeltaThreads(path, opts) };
    case 'antigravity':
      return { sessions: await extractAntigravityConversations(path, opts) };
    case 'codex':
      return { sessions: await extractCodexSessions(path, opts) };
    case 'cursor':
      return extractCursorSessions(path, opts);
    case 'vscode':
      return extractVscodeSessions(path);
  }
}

export async function syncHarnessSessions(
  sqlite: SQLiteManager,
  memory: MemoryManager,
  opts: SyncOptions = {},
): Promise<SyncResult[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
  const includeArchived = opts.includeArchived ?? false;
  const wanted = new Set(opts.harnesses ?? []);
  const results: SyncResult[] = [];
  await ensureWatermarkTable(sqlite);

  for (const store of locateStores()) {
    if (wanted.size > 0 && !wanted.has(store.harness)) continue;
    if (!store.found) {
      results.push({ harness: store.harness, found: false, scanned: 0, created: 0, updated: 0, skipped: 0, errors: [store.detail] });
      continue;
    }
    const result: SyncResult = { harness: store.harness, found: true, scanned: 0, created: 0, updated: 0, skipped: 0, errors: [], sessions: [] };
    try {
      const { sessions, note } = await extractFor(store.harness, store.path, {
        limit,
        since: opts.since,
        project: opts.project,
        includeArchived,
      });
      if (note) result.errors.push(note);
      result.scanned = sessions.length;
      const watermarks = opts.dryRun ? new Map<string, number>() : await loadWatermarks(sqlite, store.harness);
      for (const s of sessions) {
        const known = watermarks.get(s.sessionId) ?? -1;
        if (!opts.dryRun && known >= s.updatedAt) {
          result.skipped++;
          result.sessions?.push({ sessionId: s.sessionId, title: s.title, updatedAt: s.updatedAt, action: 'skipped' });
          continue;
        }
        const isUpdate = known >= 0;
        if (opts.dryRun) {
          result.sessions?.push({ sessionId: s.sessionId, title: s.title, updatedAt: s.updatedAt, action: 'dry-run' });
          if (isUpdate) result.updated++;
          else result.created++;
          continue;
        }
        try {
          const name = entityName(s);
          const existing = await memory.openNodes([name]);
          if (!existing.some((e) => e && e.name === name)) {
            await memory.createEntity(name, 'session', sessionObservations(s));
            result.created++;
          } else {
            await memory.addObservation(name, sessionObservations(s));
            result.updated++;
          }
          await saveWatermark(sqlite, store.harness, s.sessionId, s.updatedAt);
          result.sessions?.push({ sessionId: s.sessionId, title: s.title, updatedAt: s.updatedAt, action: isUpdate ? 'updated' : 'created' });
        } catch (e) {
          result.errors.push(`${s.sessionId}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    } catch (e) {
      result.errors.push(e instanceof Error ? e.message : String(e));
    }
    results.push(result);
  }
  return results;
}
