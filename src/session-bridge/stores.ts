import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { HarnessId, StoreStatus } from './types.js';

function envPath(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.length > 0 ? v : fallback;
}

function deltaUserDir(): string | null {
  const base = join(homedir(), '.local', 'share', 'delta');
  try {
    const entries = readdirSync(base, { withFileTypes: true });
    const user = entries.find((e) => e.isDirectory() && e.name.startsWith('user_'));
    return user ? join(base, user.name) : null;
  } catch {
    return null;
  }
}

/** Resolve the primary read-only source path for each harness. Never writes. */
export function locateStores(): StoreStatus[] {
  const home = homedir();
  const deltaDir = deltaUserDir();
  const candidates: Array<{ harness: HarnessId; path: string; detail: string }> = [
    {
      harness: 'opencode',
      path: envPath('HARNESS_OPENCODE_PATH', join(home, '.local', 'share', 'opencode', 'opencode.db')),
      detail: 'SQLite: session/message/part (Drizzle schema)',
    },
    {
      harness: 'kilocode',
      path: envPath('HARNESS_KILOCODE_PATH', join(home, '.local', 'share', 'kilo', 'kilo.db')),
      detail: 'SQLite: session/message/part (same Drizzle schema as opencode)',
    },
    {
      harness: 'zed',
      path: envPath('HARNESS_ZED_PATH', join(home, '.local', 'share', 'zed', 'threads', 'threads.db')),
      detail: 'SQLite: threads (summary + payload blob)',
    },
    {
      harness: 'delta',
      path: envPath(
        'HARNESS_DELTA_PATH',
        deltaDir ? join(deltaDir, 'data.sqlite') : join(home, '.local', 'share', 'delta', 'data.sqlite'),
      ),
      detail: 'SQLite: app_threads (Zed-fork layout)',
    },
    {
      harness: 'antigravity',
      path: envPath(
        'HARNESS_ANTIGRAVITY_PATH',
        join(home, '.gemini', 'antigravity-cli', 'conversation_summaries.db'),
      ),
      detail: 'SQLite: conversation_summaries (title/preview/workspace/project)',
    },
    {
      harness: 'cursor',
      path: envPath(
        'HARNESS_CURSOR_PATH',
        join(home, '.config', 'Cursor', 'User', 'workspaceStorage'),
      ),
      detail: 'Workspace state.vscdb files (best-effort; absent when Cursor not installed)',
    },
    {
      harness: 'vscode',
      path: envPath(
        'HARNESS_VSCODE_PATH',
        join(home, '.config', 'Code', 'User', 'workspaceStorage'),
      ),
      detail: 'Workspace state.vscdb files (best-effort; absent when VS Code not installed)',
    },
    {
      harness: 'codex',
      path: envPath('HARNESS_CODEX_PATH', join(home, '.codex', 'sessions')),
      detail: 'JSONL rollout files (sessions/YYYY/MM/DD) + archived_sessions/',
    },
  ];
  return candidates.map((c) => {
    let found = false;
    try {
      found = existsSync(c.path);
    } catch {
      found = false;
    }
    return { harness: c.harness, found, path: c.path, detail: c.detail };
  });
}
