import * as fs from 'fs';
import * as path from 'path';

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

  constructor() {
    const v = process.env.HELA_GENOME_OBSIDIAN_VAULT;
    this.vaultPath = v && v.trim() ? v.trim() : null;
    if (this.vaultPath) {
      try { fs.mkdirSync(this.vaultPath, { recursive: true }); } catch {}
    }
  }

  isEnabled(): boolean {
    return this.vaultPath !== null;
  }

  private safeName(name: string): string {
    return name.replace(/[\/\\:*?"<>|]/g, '_').slice(0, 120) || 'entity';
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
    } catch {
      // best-effort
    }
  }

  removeEntity(name: string): void {
    if (!this.vaultPath) return;
    try {
      const filePath = path.join(this.vaultPath, `${this.safeName(name)}.md`);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // best-effort
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
    } catch {
      // best-effort
    }
  }
}