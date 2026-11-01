import * as fs from 'fs';
import * as path from 'path';
import { exec, execSync } from 'child_process';

/**
 * Optional Obsidian vault mirror for HeLa Genome.
 *
 * Enabled by HELA_GENOME_OBSIDIAN_VAULT. When set, entity writes are mirrored
 * as Markdown notes with YAML frontmatter into the vault, so humans can browse
 * and edit project memory in Obsidian while SQLite stays the query engine.
 *
 * Best-effort: never throws into the calling memory operation.
 */

export class ObsidianVaultMirror {
  private vaultPath: string | null;
  private syncCmd: string | null;
  private pullCmd: string | null;

  constructor() {
    const v = process.env.HELA_GENOME_OBSIDIAN_VAULT;
    this.vaultPath = v && v.trim() ? v.trim() : null;
    this.syncCmd = process.env.HELA_GENOME_OBSIDIAN_SYNC_CMD?.trim() || null;
    this.pullCmd = process.env.HELA_GENOME_OBSIDIAN_PULL_CMD?.trim() || null;
    if (this.vaultPath) {
      try { fs.mkdirSync(this.vaultPath, { recursive: true }); } catch (e) { console.error('vault mkdir failed', e); }
      // Run pull synchronously so remote state is present before backfill
      if (this.pullCmd) {
        try {
          execSync(this.pullCmd, { timeout: 60000, stdio: 'ignore' });
        } catch (e) { console.error('obsidian pull failed:', (e as Error).message); }
      }
    }
  }

  private syncTimer: NodeJS.Timeout | null = null;

  private runCmd(cmd: string, label: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        exec(cmd, { timeout: 60000 }, (err, stdout, stderr) => {
          if (err) console.error(`obsidian ${label} failed:`, err.message, (stderr || '').slice(0, 200));
          resolve();
        });
      } catch (e) { void e; resolve(); }
    });
  }

  /** Debounced remote sync — collapses rapid writes into one push. */
  private triggerSync(): void {
    if (!this.syncCmd) return;
    if (this.syncTimer) clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => {
      this.syncTimer = null;
      this.runCmd(this.syncCmd!, 'sync').catch(() => {});
    }, 5000);
  }

  /** Immediate sync (used for backfill completion and shutdown). */
  async flushSync(): Promise<void> {
    if (this.syncTimer) { clearTimeout(this.syncTimer); this.syncTimer = null; }
    if (this.syncCmd) await this.runCmd(this.syncCmd, 'sync');
  }

  isEnabled(): boolean {
    return this.vaultPath !== null;
  }

  getVaultPath(): string | null {
    return this.vaultPath;
  }

  listNotes(): string[] {
    if (!this.vaultPath) return [];
    const out: string[] = [];
    const walk = (dir: string, rel: string) => {
      let entries: string[];
      try { entries = fs.readdirSync(dir); } catch { return; }
      for (const e of entries) {
        const full = path.join(dir, e);
        const r = rel ? `${rel}/${e}` : e;
        try {
          const st = fs.statSync(full);
          if (st.isDirectory()) walk(full, r);
          else if (e.endsWith('.md')) out.push(r);
        } catch { /* skip */ }
      }
    };
    walk(this.vaultPath, '');
    return out;
  }

  readNote(filename: string): string | null {
    if (!this.vaultPath) return null;
    try {
      return fs.readFileSync(path.join(this.vaultPath, filename), 'utf8');
    } catch {
      return null;
    }
  }

  /** Parse a vault note into { name, entityType, observations } or null. */
  parseNote(content: string): { name: string; entityType: string; observations: string[] } | null {
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
    if (!fmMatch) return null;
    const fm = fmMatch[1];
    const nameMatch = fm.match(/^name:\s*(.+)$/m);
    const typeMatch = fm.match(/^type:\s*(.+)$/m);
    if (!nameMatch) return null;
    let name: string;
    let entityType: string;
    try { name = JSON.parse(nameMatch[1].trim()); } catch { name = nameMatch[1].trim().replace(/^"|"$/g, ''); }
    try { entityType = typeMatch ? JSON.parse(typeMatch[1].trim()) : 'concept'; } catch { entityType = typeMatch ? typeMatch[1].trim().replace(/^"|"$/g, '') : 'concept'; }
    // observations from body: lines starting with "- "
    const body = content.slice(fmMatch[0].length);
    const observations: string[] = [];
    for (const line of body.split('\n')) {
      const m = line.match(/^- (.+)$/);
      if (m) observations.push(m[1].trim());
    }
    return { name, entityType, observations };
  }

  private safeName(name: string): string {
    let s = (name || '').replace(/[/\\:*?"<>|]/g, '_').trim().replace(/\.+$/, '');
    if (!s) s = 'entity';
    return s.slice(0, 120);
  }

  syncEntity(entity: { name: string; entityType: string; observations: string[]; createdAt: string; updatedAt: string }, relations?: Array<{ from: string; to: string; relationType: string }>): void {
    if (!this.vaultPath) return;
    // Skip junk/test entities
    const n = (entity.name || '').trim().toLowerCase();
    if (!n) return;
    if (n.startsWith('debug:') || n.startsWith('test_') || n.startsWith('test-')) return;
    if (n.startsWith('perf_run_') || n.startsWith('perf-run-') || n.startsWith('perf run') || n.startsWith('perf_warm_')) return;
    if (/^[a-z]{1,3}_-?\d+/.test(n)) return;
    if (entity.observations.length === 1 && entity.observations[0].trim().toLowerCase() === 'perf') return;
    if (n.includes('test') && (n.includes('entity') || n.includes('write') || n.includes('vault'))) return;
    try {
      const filePath = path.join(this.vaultPath, `${this.safeName(entity.name)}.md`);
      const frontmatter = [
        '---',
        `name: ${JSON.stringify(entity.name)}`,
        `type: ${JSON.stringify(entity.entityType)}`,
        `created: ${entity.createdAt}`,
        `updated: ${entity.updatedAt}`,
        `source: hela-genome`,
        '---',
        '',
      ].join('\n');
      const outgoing = (relations || []).filter((r) => r.from === entity.name);
      const incoming = (relations || []).filter((r) => r.to === entity.name);
      const body = [
        `# ${entity.name}`,
        '',
        `**Type:** ${entity.entityType}`,
        '',
        '## Observations',
        '',
        ...(entity.observations.length ? entity.observations.map((o) => `- ${o}`) : ['_(none)_']),
        '',
        '## Relations',
        '',
        ...outgoing.map((r) => `- [[${r.to}]] — ${r.relationType}`),
        ...incoming.map((r) => `- [[${r.from}]] — ${r.relationType} (incoming)`),
        ...((outgoing.length || incoming.length) ? [] : ['_(none)_']),
        '',
      ].join('\n');
      fs.writeFileSync(filePath, frontmatter + body, 'utf8');
      this.triggerSync();
    } catch (e) {
      void e;
    }
  }

  removeEntity(name: string): void {
    if (!this.vaultPath) return;
    try {
      const filePath = path.join(this.vaultPath, `${this.safeName(name)}.md`);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      this.triggerSync();
    } catch (e) {
      void e;
    }
  }

  syncRelation(relation: { from: string; to: string; relationType: string; createdAt: string }): void {
    if (!this.vaultPath) return;
    try {
      const filePath = path.join(this.vaultPath, `${this.safeName(relation.from)}__${relation.relationType}__${this.safeName(relation.to)}.md`);
      const content = [
        '---',
        `from: ${JSON.stringify(relation.from)}`,
        `to: ${JSON.stringify(relation.to)}`,
        `relation: ${JSON.stringify(relation.relationType)}`,
        `created: ${relation.createdAt}`,
        `source: hela-genome`,
        '---',
        '',
        `# ${relation.from} → ${relation.to}`,
        '',
        `Relation: **${relation.relationType}**`,
        '',
      ].join('\n');
      fs.writeFileSync(filePath, content, 'utf8');
      this.triggerSync();
    } catch (e) {
      void e;
    }
  }
}