import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

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
      if (this.pullCmd) this.runCmd(this.pullCmd, 'pull');
    }
  }

  private runCmd(cmd: string, label: string): void {
    try {
      exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
        if (err) console.error(`obsidian ${label} failed:`, err.message, stderr);
      });
    } catch (e) { void e; }
  }

  /** Trigger a remote sync after a write (best-effort, async). */
  private triggerSync(): void {
    if (this.syncCmd) this.runCmd(this.syncCmd, 'sync');
  }

  isEnabled(): boolean {
    return this.vaultPath !== null;
  }

  getVaultPath(): string | null {
    return this.vaultPath;
  }

  listNotes(): string[] {
    if (!this.vaultPath) return [];
    try {
      return fs.readdirSync(this.vaultPath).filter((f) => f.endsWith('.md'));
    } catch {
      return [];
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

  readNote(filename: string): string | null {
    if (!this.vaultPath) return null;
    try {
      return fs.readFileSync(path.join(this.vaultPath, filename), 'utf8');
    } catch {
      return null;
    }
  }

  private safeName(name: string): string {
    return name.replace(/[/\\:*?"<>|]/g, '_').slice(0, 120) || 'entity';
  }

  syncEntity(entity: { name: string; entityType: string; observations: string[]; createdAt: string; updatedAt: string }): void {
    if (!this.vaultPath) return;
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
      const body = [
        `# ${entity.name}`,
        '',
        `**Type:** ${entity.entityType}`,
        '',
        '## Observations',
        '',
        ...(entity.observations.length ? entity.observations.map((o) => `- ${o}`) : ['_(none)_']),
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