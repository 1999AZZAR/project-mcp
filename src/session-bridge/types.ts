export type HarnessId =
  | 'opencode'
  | 'kilocode'
  | 'zed'
  | 'delta'
  | 'antigravity'
  | 'cursor'
  | 'vscode'
  | 'codex';

export const ALL_HARNESSES: HarnessId[] = [
  'opencode',
  'kilocode',
  'zed',
  'delta',
  'antigravity',
  'cursor',
  'vscode',
  'codex',
];

export interface StoreStatus {
  harness: HarnessId;
  found: boolean;
  path: string;
  detail: string;
}

export interface HarnessSession {
  harness: HarnessId;
  sessionId: string;
  project?: string;
  title: string;
  summary?: string;
  updatedAt: number;
  messageCount?: number;
  model?: string;
  archived?: boolean;
}

export interface SyncOptions {
  harnesses?: HarnessId[];
  project?: string;
  since?: number;
  limit?: number;
  dryRun?: boolean;
  includeArchived?: boolean;
}

export interface SyncResult {
  harness: HarnessId;
  found: boolean;
  scanned: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  sessions?: Array<Pick<HarnessSession, 'sessionId' | 'title' | 'updatedAt'> & { action: 'created' | 'updated' | 'skipped' | 'dry-run' }>;
}
