import { SQLiteManager } from './sqlite-manager.js';
import { Entity, Relation, KnowledgeGraph, SearchResult } from './types.js';
import {
  ObservationProvenance,
  ensureObservationProvenanceSchema,
  recordObservationProvenance,
} from './observation-provenance.js';
import { embedText, toVecString } from './vector-manager.js';
import * as fs from 'fs';
import * as path from 'path';
import { exec, execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { homedir } from 'os';
import { isAbsolute, resolve, basename, dirname, join as joinPath } from 'path';
import { createInterface } from 'readline';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const MAX_CENTRAL_BACKUPS = 7;

export class MemoryManager {
  private sqliteManager: SQLiteManager;
  private memoryDbName: string = 'memory';
  private targetRoot: string;
  private centralDbPath: string;

  constructor(sqliteManager: SQLiteManager, targetRoot?: string) {
    this.sqliteManager = sqliteManager;
    this.targetRoot = targetRoot ?? process.cwd();
    const configured = process.env.GUARDIAN_CENTRAL_DB;
    this.centralDbPath = (configured && isAbsolute(configured))
      ? resolve(configured)
      : path.join(homedir(), 'memory', 'memory.db');
  }

  private async ensureFtsSchema(dbName: string): Promise<void> {
    await this.sqliteManager.executeSql(dbName, `
      CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
        name, 
        entity_type, 
        observations,
        content='entities',
        content_rowid='rowid'
      );
    `);

    await this.sqliteManager.executeSql(dbName, `
      CREATE TRIGGER IF NOT EXISTS entities_ai AFTER INSERT ON entities BEGIN
        INSERT INTO entities_fts(rowid, name, entity_type, observations) 
        VALUES (new.rowid, new.name, new.entity_type, new.observations);
      END;
    `);

    await this.sqliteManager.executeSql(dbName, `
      CREATE TRIGGER IF NOT EXISTS entities_ad AFTER DELETE ON entities BEGIN
        INSERT INTO entities_fts(entities_fts, rowid, name, entity_type, observations) 
        VALUES('delete', old.rowid, old.name, old.entity_type, old.observations);
      END;
    `);

    await this.sqliteManager.executeSql(dbName, `
      CREATE TRIGGER IF NOT EXISTS entities_au AFTER UPDATE ON entities BEGIN
        INSERT INTO entities_fts(entities_fts, rowid, name, entity_type, observations) 
        VALUES('delete', old.rowid, old.name, old.entity_type, old.observations);
        INSERT INTO entities_fts(rowid, name, entity_type, observations) 
        VALUES (new.rowid, new.name, new.entity_type, new.observations);
      END;
    `);

    // Backfill FTS index if it was just created or if it went out of sync
    await this.sqliteManager.executeSql(dbName, `
      INSERT INTO entities_fts(entities_fts) VALUES('rebuild');
    `);
  }

  setTargetRoot(targetRoot: string): void {
    this.targetRoot = targetRoot;
  }

  private async ensureCentralSchema(): Promise<void> {
    await this.sqliteManager.createTable(this.centralDbPath, 'entities', {
      columns: [
        { name: 'name', type: 'TEXT', constraints: ['PRIMARY KEY', 'NOT NULL'] },
        { name: 'entity_type', type: 'TEXT', constraints: ['NOT NULL'] },
        { name: 'observations', type: 'TEXT', constraints: ['NOT NULL'] },
        { name: 'created_at', type: 'TEXT', constraints: ['NOT NULL'] },
        { name: 'updated_at', type: 'TEXT', constraints: ['NOT NULL'] }
      ]
    });
    await this.sqliteManager.createTable(this.centralDbPath, 'relations', {
      columns: [
        { name: 'id', type: 'INTEGER', constraints: ['PRIMARY KEY', 'AUTOINCREMENT'] },
        { name: 'from_entity', type: 'TEXT', constraints: ['NOT NULL'] },
        { name: 'to_entity', type: 'TEXT', constraints: ['NOT NULL'] },
        { name: 'relation_type', type: 'TEXT', constraints: ['NOT NULL'] },
        { name: 'created_at', type: 'TEXT', constraints: ['NOT NULL'] }
      ],
      indexes: [
        { name: 'idx_central_relations_unique', columns: ['from_entity', 'to_entity', 'relation_type'], unique: true }
      ]
    });
    
    await this.ensureFtsSchema(this.centralDbPath);
    try {
      await this.sqliteManager.executeSql(this.centralDbPath, `CREATE VIRTUAL TABLE IF NOT EXISTS vec_entities USING vec0(embedding float[${384}])`);
    } catch {}
  }

  private projectSchemaReady = false;
  private async ensureProjectSchema(): Promise<void> {
    if (this.projectSchemaReady) return;
    // idempotent: IF NOT EXISTS handles re-entrancy, flag avoids extra I/O after warm
    await this.sqliteManager.createTable(this.memoryDbName, 'entities', {
      columns: [
        { name: 'name', type: 'TEXT', constraints: ['PRIMARY KEY', 'NOT NULL'] },
        { name: 'entity_type', type: 'TEXT', constraints: ['NOT NULL'] },
        { name: 'observations', type: 'TEXT', constraints: ['NOT NULL'] },
        { name: 'created_at', type: 'TEXT', constraints: ['NOT NULL'] },
        { name: 'updated_at', type: 'TEXT', constraints: ['NOT NULL'] }
      ]
    });
    await this.sqliteManager.createTable(this.memoryDbName, 'relations', {
      columns: [
        { name: 'id', type: 'INTEGER', constraints: ['PRIMARY KEY', 'AUTOINCREMENT'] },
        { name: 'from_entity', type: 'TEXT', constraints: ['NOT NULL'] },
        { name: 'to_entity', type: 'TEXT', constraints: ['NOT NULL'] },
        { name: 'relation_type', type: 'TEXT', constraints: ['NOT NULL'] },
        { name: 'created_at', type: 'TEXT', constraints: ['NOT NULL'] }
      ],
      indexes: [
        { name: 'idx_relations_from', columns: ['from_entity'] },
        { name: 'idx_relations_to', columns: ['to_entity'] },
        { name: 'idx_relations_type', columns: ['relation_type'] }
      ]
    });
    const r1 = await this.sqliteManager.executeSql(this.memoryDbName, 'CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type)');
    if (!r1.success) console.warn('Failed to create entity type index:', r1.error);
    const r2 = await this.sqliteManager.executeSql(this.memoryDbName, 'CREATE INDEX IF NOT EXISTS idx_entities_updated ON entities(updated_at)');
    if (!r2.success) console.warn('Failed to create entity updated index:', r2.error);
    await this.ensureFtsSchema(this.memoryDbName);
    const vecRes = await this.sqliteManager.executeSql(this.memoryDbName, `CREATE VIRTUAL TABLE IF NOT EXISTS vec_entities USING vec0(embedding float[384])`);
    if (!vecRes.success) console.warn('[vec] create table failed for', this.memoryDbName, vecRes.error);
    // P1-C2: provenance sidecar for externally-sourced observation facts
    await ensureObservationProvenanceSchema(this.sqliteManager, this.memoryDbName);
    this.projectSchemaReady = true;
  }

  private async upsertVec(dbName: string, entityName: string, text: string): Promise<void> {
    if (process.env.NODE_ENV === 'test' && !process.env.ENABLE_VECTOR_TEST) return;
    try {
      const vec = await embedText(text);
      const vecStr = toVecString(vec);
      // rowid mapping to entities
      const row = await this.sqliteManager.executeSql(dbName, `SELECT rowid FROM entities WHERE name=?`, [entityName]);
      if (!row.success || !row.data || row.data.rows.length === 0) return;
      const rowid = (row.data.rows[0] as any).rowid ?? (row.data.rows[0] as any).ROWID;
      // vec0 upsert: delete then insert (vec0 has no UPDATE)
      await this.sqliteManager.executeSql(dbName, `DELETE FROM vec_entities WHERE rowid=?`, [rowid]);
      const ins = await this.sqliteManager.executeSql(dbName, `INSERT INTO vec_entities(rowid, embedding) VALUES (?, ?)`, [rowid, vecStr]);
      if (!ins.success) throw new Error(ins.error);
    } catch (e) {
      console.warn(`vec upsert failed for ${entityName}:`, (e as Error).message);
    }
  }

  async syncToCentral(): Promise<{ entities: number; relations: number }> {
    const graph = await this.readStore(this.memoryDbName, { limit: 10000 });
    if (graph.entities.length === 0 && graph.relations.length === 0) {
      return { entities: 0, relations: 0 };
    }

    await this.ensureCentralSchema();
    // P1-C2: central sidecar so synced observations keep their provenance refs
    await ensureObservationProvenanceSchema(this.sqliteManager, this.centralDbPath);

    // batch in single transaction — was N separate writes, now 1 fsync
    await this.sqliteManager.executeSql(this.centralDbPath, 'BEGIN TRANSACTION');
    try {
      for (const entity of graph.entities) {
        const r = await this.sqliteManager.executeSql(
          this.centralDbPath,
          `INSERT OR REPLACE INTO entities (name, entity_type, observations, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
          [entity.name, entity.entityType, JSON.stringify(entity.observations), entity.createdAt, entity.updatedAt]
        );
        if (!r.success) throw new Error(r.error);
        // P1-C2: carry the entity's provenance sidecar rows to central (idempotent)
        const prov = await this.sqliteManager.executeSql(
          this.memoryDbName,
          `SELECT observation, source, retrieved_at, confidence, freshness FROM observation_provenance WHERE entity_name = ?`,
          [entity.name]
        );
        if (prov.success && prov.data) {
          for (const row of prov.data.rows as any[]) {
            const cp = await this.sqliteManager.executeSql(
              this.centralDbPath,
              `INSERT OR REPLACE INTO observation_provenance
               (entity_name, observation, source, retrieved_at, confidence, freshness)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [entity.name, row.observation, row.source, row.retrieved_at, row.confidence ?? null, row.freshness ?? null]
            );
            if (!cp.success) throw new Error(cp.error);
          }
        }
      }
      for (const relation of graph.relations) {
        const r = await this.sqliteManager.executeSql(
          this.centralDbPath,
          `INSERT OR IGNORE INTO relations (from_entity, to_entity, relation_type, created_at) VALUES (?, ?, ?, ?)`,
          [relation.from, relation.to, relation.relationType, relation.createdAt]
        );
        if (!r.success) throw new Error(r.error);
      }
      await this.sqliteManager.executeSql(this.centralDbPath, 'COMMIT');
    } catch (e) {
      try { await this.sqliteManager.executeSql(this.centralDbPath, 'ROLLBACK'); } catch {}
      throw e;
    }

    await this.backupCentralIfNeeded();
    return { entities: graph.entities.length, relations: graph.relations.length };
  }

  private async syncToCentralSafe(): Promise<void> {
    if (process.env.NODE_ENV === 'test') return;
    try {
      await this.syncToCentral();
    } catch (err) {
      console.warn('Central memory sync failed:', err);
    }
  }

  getCentralDatabaseId(): string {
    return this.centralDbPath;
  }

  static buildBackupName(date: Date): string {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${dd}${mm}${date.getFullYear()}_memory.db`;
  }

  static parseBackupName(filename: string): Date | null {
    const match = /^(\d{2})(\d{2})(\d{4})_memory\.db$/.exec(basename(filename));
    if (!match) return null;
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime()) || date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
      return null;
    }
    return date;
  }

  static selectBackupsToPrune(filenames: string[], maxKeep: number): string[] {
    if (maxKeep < 0) maxKeep = 0;
    const dated = filenames
      .map(name => ({ name, date: MemoryManager.parseBackupName(name) }))
      .filter((entry): entry is { name: string; date: Date } => entry.date !== null)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    return dated.slice(maxKeep).map(entry => entry.name).reverse();
  }

  private getBackupDir(): string {
    return joinPath(dirname(this.centralDbPath), 'backup');
  }

  private async migrateLegacyCentralDatabase(): Promise<void> {
    const legacyPath = path.join(homedir(), 'memory.db');
    if (this.centralDbPath === legacyPath) return;
    if (!fs.existsSync(legacyPath) || fs.existsSync(this.centralDbPath)) return;

    try {
      fs.mkdirSync(dirname(this.centralDbPath), { recursive: true });
      fs.copyFileSync(legacyPath, this.centralDbPath);

      // Verify the copy is readable before touching the original
      const probe = await this.sqliteManager.executeSql(this.centralDbPath, 'SELECT COUNT(*) as count FROM entities');
      if (!probe.success || !probe.data || typeof probe.data.rows[0]?.count !== 'number') {
        throw new Error(probe.error || 'central database probe failed');
      }

      fs.mkdirSync(this.getBackupDir(), { recursive: true });
      const seedBackup = joinPath(this.getBackupDir(), MemoryManager.buildBackupName(new Date()));
      if (!fs.existsSync(seedBackup)) {
        fs.copyFileSync(legacyPath, seedBackup);
        this.pruneBackupsSync();
      }

      fs.unlinkSync(legacyPath);
      console.error(`Migrated central memory from ${legacyPath} to ${this.centralDbPath}`);
    } catch (err) {
      console.error(`Central memory migration failed; continuing with legacy path ${legacyPath}:`, err);
      this.centralDbPath = legacyPath;
    }
  }

  private pruneBackupsSync(): void {
    try {
      const backupDir = this.getBackupDir();
      if (!fs.existsSync(backupDir)) return;
      const stale = MemoryManager.selectBackupsToPrune(fs.readdirSync(backupDir), MAX_CENTRAL_BACKUPS);
      for (const name of stale) {
        try { fs.unlinkSync(joinPath(backupDir, name)); } catch (e) {}
      }
    } catch (err) {
      console.warn('Backup pruning failed:', err);
    }
  }

  private async backupCentralIfNeeded(): Promise<void> {
    try {
      if (!fs.existsSync(this.centralDbPath)) return;
      const backupDir = this.getBackupDir();
      fs.mkdirSync(backupDir, { recursive: true });

      const todayBackup = joinPath(backupDir, MemoryManager.buildBackupName(new Date()));
      if (!fs.existsSync(todayBackup)) {
        const escaped = todayBackup.replace(/'/g, "''");
        await this.sqliteManager.executeSql(this.centralDbPath, `VACUUM INTO '${escaped}'`);
      }
      this.pruneBackupsSync();
    } catch (err) {
      console.warn('Central memory backup failed:', err);
    }
  }

  async setupProjectFiles(): Promise<void> {
    const manageProjectFiles = process.env.NODE_ENV !== 'test';
    if (!manageProjectFiles) return;

    const targetRoot = this.targetRoot;

    // Pre-commit hook initialization — only on explicit request
    try {
      await execAsync('which pre-commit');
      await execAsync('git rev-parse --git-dir 2>/dev/null', { cwd: targetRoot });
    } catch {
      throw new Error('pre-commit and a Git repository are required in the project root');
    }

    try {
      const preCommitConfigPath = path.join(targetRoot, '.pre-commit-config.yaml');

      if (!fs.existsSync(preCommitConfigPath)) {
        const hasPython = fs.existsSync(path.join(targetRoot, 'requirements.txt')) ||
                          fs.existsSync(path.join(targetRoot, 'pyproject.toml')) ||
                          fs.existsSync(path.join(targetRoot, 'setup.py'));
        const hasNode = fs.existsSync(path.join(targetRoot, 'package.json'));

        const repos = [`  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
        args: [--maxkb=500]
      - id: check-merge-conflict
      - id: detect-private-key`];

        if (hasPython) {
          repos.push(`  - repo: https://github.com/psf/black
    rev: 24.4.2
    hooks:
      - id: black
        args: [--line-length=100]

  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.11.0
    hooks:
      - id: ruff
        args: [--fix]`);
        }

        if (hasNode) {
          repos.push(`  - repo: https://github.com/pre-commit/mirrors-prettier
    rev: v3.1.0
    hooks:
      - id: prettier
        types_or: [javascript, jsx, ts, tsx, css, less, html, json, markdown]`);
        }

        repos.push(`  - repo: local
    hooks:
      - id: project-guardian-auto-combine
        name: Auto-combine scattered memory.db files
        entry: >
            bash -c 'find . -mindepth 2 -type f -name memory.db | while read db; do sqlite3 memory.db "ATTACH DATABASE \\"$db\\" AS nested; INSERT OR IGNORE INTO entities SELECT * FROM nested.entities; INSERT OR IGNORE INTO relations SELECT * FROM nested.relations;"; rm "$db"; done'
        language: system
        always_run: true
        pass_filenames: false`);

        const preCommitContent = `repos:\n${repos.join('\n\n')}\n`;
        fs.writeFileSync(preCommitConfigPath, preCommitContent, 'utf8');
        const ac = new AbortController();
        const timeoutId = setTimeout(() => ac.abort(), 30000);
        try {
          await execFileAsync('pre-commit', ['install'], { cwd: targetRoot, signal: ac.signal });
        } finally {
          clearTimeout(timeoutId);
        }
      }
    } catch (err) {
      throw new Error(`Failed to set up pre-commit hooks: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Gitignore initialization — append only entries that are not already ignored
    try {
      const guardianEntries = [
        'memory.db',
        'memory.db-journal',
        '.claude/',
        '.vscode/',
        '.idea/',
        '.gemini/',
        '.cursor/',
        '.env',
        '.env.*',
        '!.env.example',
      ];
      const gitignorePath = path.join(targetRoot, '.gitignore');
      const existing = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
      const missing = guardianEntries.filter(entry => !existing.split(/\r?\n/).some(line => line.trim() === entry));
      if (missing.length > 0) {
        const block = `\n# Project Guardian\n${missing.join('\n')}\n`;
        if (!fs.existsSync(gitignorePath)) {
          fs.writeFileSync(gitignorePath, `# Project Guardian\n${guardianEntries.join('\n')}\n`, 'utf8');
        } else {
          fs.appendFileSync(gitignorePath, block, 'utf8');
        }
      }
    } catch (err) {
      console.warn('Failed to update .gitignore:', err);
    }
  }

  async initializeMemoryDatabase(): Promise<void> {
    // Note: Database will be created automatically when first accessed
    const manageProjectFiles = process.env.NODE_ENV !== 'test';

    const targetRoot = this.targetRoot;

    // Central memory is always available, regardless of configuration
    if (manageProjectFiles) try {
      await this.migrateLegacyCentralDatabase();
      await this.ensureCentralSchema();
    } catch (err) {
      console.warn('Central memory initialization failed:', err);
    }

    await this.ensureProjectSchema();

    // Scattered DB consolidation — DESTRUCTIVE (merges nested memory.db files
    // into the root and deletes them, destroying per-project isolation).
    // Disabled by default; opt in with GUARDIAN_AUTO_MERGE=1.
    if (manageProjectFiles && process.env.GUARDIAN_AUTO_MERGE === '1' && targetRoot !== (process.env.HOME || '')) {
      const rootDbPath = path.join(targetRoot, 'memory.db');
      let mergeCount = 0;
      const MAX_MERGE = 100;

      const findProcess = spawn('find', [targetRoot, '-mindepth', '2', '-type', 'f', '-name', 'memory.db']);
      const rl = createInterface({ input: findProcess.stdout });

      try {
        for await (const line of rl) {
          if (mergeCount >= MAX_MERGE) {
            console.warn(`Scattered DB merge capped at ${MAX_MERGE} files, skipping rest`);
            findProcess.kill();
            break;
          }
          const dbPath = line.trim();
          if (!dbPath || dbPath === rootDbPath) continue;
          
          try {
            const escapedPath = dbPath.replace(/'/g, "''");
            await this.sqliteManager.executeSql(this.memoryDbName, `ATTACH DATABASE '${escapedPath}' AS nested`);
            await this.sqliteManager.executeSql(this.memoryDbName, `INSERT OR IGNORE INTO entities SELECT * FROM nested.entities`);
            await this.sqliteManager.executeSql(this.memoryDbName, `INSERT OR IGNORE INTO relations SELECT * FROM nested.relations`);
            await this.sqliteManager.executeSql(this.memoryDbName, `DETACH DATABASE nested`);
            
            fs.unlinkSync(dbPath);
            mergeCount++;
          } catch (mergeErr) {
            console.error(`Failed to merge scattered database ${dbPath}:`, mergeErr);
            try { await this.sqliteManager.executeSql(this.memoryDbName, `DETACH DATABASE nested`); } catch (e) {}
          }
        }
      } catch (e) {
        console.warn('Scattered DB scan failed:', e);
      }
    }

    await this.syncToCentralSafe();
  }

  async createEntity(name: string, entityType: string, observations: string[], provenance?: Array<ObservationProvenance | undefined>): Promise<Entity> {
    if (!this.projectSchemaReady) await this.ensureProjectSchema();
    const now = new Date().toISOString();

    // Check if entity already exists
    const existing = await this.sqliteManager.queryData(this.memoryDbName, 'entities', { name });
    if (existing.success && existing.data && existing.data.rows.length > 0) {
      throw new Error(`Entity '${name}' already exists`);
    }

    const observationsJson = JSON.stringify(observations);

    const insertResult = await this.sqliteManager.insertData(this.memoryDbName, 'entities', [{
      name,
      entity_type: entityType,
      observations: observationsJson,
      created_at: now,
      updated_at: now
    }]);

    if (!insertResult.success) {
      throw new Error(`Failed to create entity: ${insertResult.error || insertResult.message}`);
    }

    // best-effort vector embed (name + observations)
    const text = `${name} ${entityType} ${observations.join(' ')}`;
    await this.upsertVec(this.memoryDbName, name, text);

    // P1-C2: provenance sidecar (best-effort, never fails the create)
    await recordObservationProvenance(this.sqliteManager, this.memoryDbName, name, observations, provenance);

    return {
      name,
      entityType,
      observations,
      createdAt: now,
      updatedAt: now
    };
  }

  async createEntities(entities: Array<{ name: string; entityType: string; observations: string[]; provenance?: Array<ObservationProvenance | undefined> }>): Promise<Entity[]> {
    if (!this.projectSchemaReady) await this.ensureProjectSchema();
    const results: Entity[] = [];
    // single transaction for batch — avoids N fsyncs
    await this.sqliteManager.executeSql(this.memoryDbName, 'BEGIN TRANSACTION');
    try {
      for (const entity of entities) {
        try {
          const created = await this.createEntity(entity.name, entity.entityType, entity.observations, entity.provenance);
          results.push(created);
        } catch (error) {
          console.error(`Failed to create entity ${entity.name}:`, error);
        }
      }
      await this.sqliteManager.executeSql(this.memoryDbName, 'COMMIT');
    } catch (e) {
      try { await this.sqliteManager.executeSql(this.memoryDbName, 'ROLLBACK'); } catch {}
      throw e;
    }

    if (results.length > 0) await this.syncToCentralSafe();
    return results;
  }

  async createRelation(from: string, to: string, relationType: string): Promise<Relation> {
    if (!this.projectSchemaReady) await this.ensureProjectSchema();
    // Verify entities exist
    const fromEntity = await this.sqliteManager.queryData(this.memoryDbName, 'entities', { name: from });
    const toEntity = await this.sqliteManager.queryData(this.memoryDbName, 'entities', { name: to });

    if (!fromEntity.success || !fromEntity.data || fromEntity.data.rows.length === 0) {
      throw new Error(`Entity '${from}' does not exist`);
    }
    if (!toEntity.success || !toEntity.data || toEntity.data.rows.length === 0) {
      throw new Error(`Entity '${to}' does not exist`);
    }

    const now = new Date().toISOString();

    const insertResult = await this.sqliteManager.insertData(this.memoryDbName, 'relations', [{
      from_entity: from,
      to_entity: to,
      relation_type: relationType,
      created_at: now
    }]);

    if (!insertResult.success) {
      throw new Error(`Failed to create relation: ${insertResult.error || insertResult.message}`);
    }

    return {
      from,
      to,
      relationType,
      createdAt: now
    };
  }

  async createRelations(relations: Array<{ from: string; to: string; relationType: string }>): Promise<Relation[]> {
    if (!this.projectSchemaReady) await this.ensureProjectSchema();
    const results: Relation[] = [];
    await this.sqliteManager.executeSql(this.memoryDbName, 'BEGIN TRANSACTION');
    try {
      for (const relation of relations) {
        try {
          const created = await this.createRelation(relation.from, relation.to, relation.relationType);
          results.push(created);
        } catch (error) {
          console.error(`Failed to create relation ${relation.from} -> ${relation.to}:`, error);
        }
      }
      await this.sqliteManager.executeSql(this.memoryDbName, 'COMMIT');
    } catch (e) {
      try { await this.sqliteManager.executeSql(this.memoryDbName, 'ROLLBACK'); } catch {}
      throw e;
    }

    if (results.length > 0) await this.syncToCentralSafe();
    return results;
  }

  async addObservation(entityName: string, contents: string[], provenance?: Array<ObservationProvenance | undefined>): Promise<Entity> {
    if (!this.projectSchemaReady) await this.ensureProjectSchema();
    // Get current entity
    const result = await this.sqliteManager.queryData(this.memoryDbName, 'entities', { name: entityName });
    if (!result.success || !result.data || result.data.rows.length === 0) {
      throw new Error(`Entity '${entityName}' does not exist`);
    }

    const entity = result.data.rows[0];
    const currentObservations = this.safeParseObservations(entity.observations);
    const updatedObservations = [...currentObservations, ...contents];
    const now = new Date().toISOString();

    await this.sqliteManager.updateData(
      this.memoryDbName,
      'entities',
      { name: entityName },
      {
        observations: JSON.stringify(updatedObservations),
        updated_at: now
      }
    );

    // re-embed with updated observations
    const text = `${entityName} ${entity.entity_type} ${updatedObservations.join(' ')}`;
    await this.upsertVec(this.memoryDbName, entityName, text);

    // P1-C2: provenance sidecar (best-effort, never fails the write)
    await recordObservationProvenance(this.sqliteManager, this.memoryDbName, entityName, contents, provenance);

    return {
      name: entity.name,
      entityType: entity.entity_type,
      observations: updatedObservations,
      createdAt: entity.created_at,
      updatedAt: now
    };
  }

  async addObservations(observations: Array<{ entityName: string; contents: string[]; provenance?: Array<ObservationProvenance | undefined> }>): Promise<Entity[]> {
    if (!this.projectSchemaReady) await this.ensureProjectSchema();
    const results: Entity[] = [];
    await this.sqliteManager.executeSql(this.memoryDbName, 'BEGIN TRANSACTION');
    try {
      for (const obs of observations) {
        try {
          const updated = await this.addObservation(obs.entityName, obs.contents, obs.provenance);
          results.push(updated);
        } catch (error) {
          console.error(`Failed to add observations to entity ${obs.entityName}:`, error);
        }
      }
      await this.sqliteManager.executeSql(this.memoryDbName, 'COMMIT');
    } catch (e) {
      try { await this.sqliteManager.executeSql(this.memoryDbName, 'ROLLBACK'); } catch {}
      throw e;
    }

    if (results.length > 0) await this.syncToCentralSafe();
    return results;
  }

  async deleteEntity(entityName: string): Promise<void> {
    if (!this.projectSchemaReady) await this.ensureProjectSchema();
    // capture rowid for vec before delete
    let rowid: number | null = null;
    try {
      const r = await this.sqliteManager.executeSql(this.memoryDbName, `SELECT rowid FROM entities WHERE name=?`, [entityName]);
      if (r.success && r.data && r.data.rows.length > 0) rowid = (r.data.rows[0] as any).rowid;
    } catch {}
    await this.sqliteManager.executeSql(this.memoryDbName, 'BEGIN TRANSACTION');
    try {
      await this.sqliteManager.deleteData(this.memoryDbName, 'relations',
        { from_entity: entityName });
      await this.sqliteManager.deleteData(this.memoryDbName, 'relations',
        { to_entity: entityName });
      if (rowid !== null) {
        try { await this.sqliteManager.executeSql(this.memoryDbName, `DELETE FROM vec_entities WHERE rowid=?`, [rowid]); } catch {}
      }
      await this.sqliteManager.deleteData(this.memoryDbName, 'entities',
        { name: entityName });
      await this.sqliteManager.executeSql(this.memoryDbName, 'COMMIT');
    } catch (error) {
      await this.sqliteManager.executeSql(this.memoryDbName, 'ROLLBACK');
      throw error;
    }
  }

  async deleteEntities(entityNames: string[]): Promise<void> {
    for (const name of entityNames) {
      await this.deleteEntity(name);
    }
    await this.syncToCentralSafe();
  }

  async deleteObservation(entityName: string, observations: string[]): Promise<Entity> {
    if (!this.projectSchemaReady) await this.ensureProjectSchema();
    // Get current entity
    const result = await this.sqliteManager.queryData(this.memoryDbName, 'entities', { name: entityName });
    if (!result.success || !result.data || result.data.rows.length === 0) {
      throw new Error(`Entity '${entityName}' does not exist`);
    }

    const entity = result.data.rows[0];
    const currentObservations = this.safeParseObservations(entity.observations);
    const updatedObservations = currentObservations.filter((obs: string) => !observations.includes(obs));
    const now = new Date().toISOString();

    await this.sqliteManager.updateData(
      this.memoryDbName,
      'entities',
      { name: entityName },
      {
        observations: JSON.stringify(updatedObservations),
        updated_at: now
      }
    );

    const text = `${entityName} ${entity.entity_type} ${updatedObservations.join(' ')}`;
    await this.upsertVec(this.memoryDbName, entityName, text);

    return {
      name: entity.name,
      entityType: entity.entity_type,
      observations: updatedObservations,
      createdAt: entity.created_at,
      updatedAt: now
    };
  }

  async deleteObservations(deletions: Array<{ entityName: string; observations: string[] }>): Promise<Entity[]> {
    if (!this.projectSchemaReady) await this.ensureProjectSchema();
    const results: Entity[] = [];
    await this.sqliteManager.executeSql(this.memoryDbName, 'BEGIN TRANSACTION');
    try {
      for (const deletion of deletions) {
        try {
          const updated = await this.deleteObservation(deletion.entityName, deletion.observations);
          results.push(updated);
        } catch (error) {
          console.error(`Failed to delete observations from entity ${deletion.entityName}:`, error);
        }
      }
      await this.sqliteManager.executeSql(this.memoryDbName, 'COMMIT');
    } catch (e) {
      try { await this.sqliteManager.executeSql(this.memoryDbName, 'ROLLBACK'); } catch {}
      throw e;
    }

    if (results.length > 0) await this.syncToCentralSafe();
    return results;
  }

  async deleteRelation(from: string, to: string, relationType: string): Promise<void> {
    await this.sqliteManager.deleteData(this.memoryDbName, 'relations', {
      from_entity: from,
      to_entity: to,
      relation_type: relationType
    });
  }

  async deleteRelations(relations: Array<{ from: string; to: string; relationType: string }>): Promise<void> {
    for (const relation of relations) {
      await this.deleteRelation(relation.from, relation.to, relation.relationType);
    }
    await this.syncToCentralSafe();
  }

  private rowToEntity(row: any): Entity {
    return {
      name: row.name,
      entityType: row.entity_type,
      observations: this.safeParseObservations(row.observations),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private rowToRelation(row: any): Relation {
    return {
      from: row.from_entity,
      to: row.to_entity,
      relationType: row.relation_type,
      createdAt: row.created_at
    };
  }

  private mergeGraphs(graphs: KnowledgeGraph[]): KnowledgeGraph {
    const entities = new Map<string, Entity>();
    const relations = new Map<string, Relation>();
    for (const graph of graphs) {
      for (const entity of graph.entities) {
        // Project entries win over central mirrors
        if (!entities.has(entity.name)) entities.set(entity.name, entity);
      }
      for (const relation of graph.relations) {
        const key = `${relation.from}\u0000${relation.to}\u0000${relation.relationType}`;
        if (!relations.has(key)) relations.set(key, relation);
      }
    }
    return { entities: [...entities.values()], relations: [...relations.values()] };
  }

  async readStore(database: string, opts?: { limit?: number; offset?: number }): Promise<KnowledgeGraph> {
    const limit = opts?.limit ?? 5000;
    const offset = opts?.offset;
    const entitiesResult = await this.sqliteManager.queryData(database, 'entities', {}, limit, offset, 'updated_at', 'DESC');
    const relationsResult = await this.sqliteManager.queryData(database, 'relations', {}, limit, offset);
    return {
      entities: (entitiesResult.success && entitiesResult.data)
        ? entitiesResult.data.rows.map((row: any) => this.rowToEntity(row))
        : [],
      relations: (relationsResult.success && relationsResult.data)
        ? relationsResult.data.rows.map((row: any) => this.rowToRelation(row))
        : []
    };
  }

  async readGraph(opts?: { limit?: number; offset?: number }): Promise<KnowledgeGraph> {
    const limit = opts?.limit ?? 5000;
    const offset = opts?.offset;
    const projectResult = await this.sqliteManager.queryData(this.memoryDbName, 'entities', {}, limit, offset, 'updated_at', 'DESC');
    const projectRelations = await this.sqliteManager.queryData(this.memoryDbName, 'relations', {}, limit, offset);
    const centralResult = await this.sqliteManager.queryData(this.centralDbPath, 'entities', {}, limit, offset, 'updated_at', 'DESC');
    const centralRelations = await this.sqliteManager.queryData(this.centralDbPath, 'relations', {}, limit, offset);

    return this.mergeGraphs([
      {
        entities: (projectResult.success && projectResult.data)
          ? projectResult.data.rows.map((row: any) => this.rowToEntity(row))
          : [],
        relations: (projectRelations.success && projectRelations.data)
          ? projectRelations.data.rows.map((row: any) => this.rowToRelation(row))
          : []
      },
      {
        entities: (centralResult.success && centralResult.data)
          ? centralResult.data.rows.map((row: any) => this.rowToEntity(row))
          : [],
        relations: (centralRelations.success && centralRelations.data)
          ? centralRelations.data.rows.map((row: any) => this.rowToRelation(row))
          : []
      }
    ]);
  }

  async vacuumDatabases(): Promise<void> {
    await this.sqliteManager.vacuumDatabase(this.memoryDbName);
    await this.sqliteManager.vacuumDatabase(this.centralDbPath);
    // schedule next monthly VACUUM (30d) - fire-and-forget
    setTimeout(() => this.vacuumDatabases().catch(() => {}), 30 * 24 * 60 * 60 * 1000);
  }

  async readGraphStream(cursor?: string, limit: number = 500): Promise<{ entities: Entity[]; relations: Relation[]; nextCursor: string | null }> {
    const capped = Math.min(Math.max(limit, 1), 1000);
    let decoded: { updated_at: string; name: string } | null = null;
    if (cursor) {
      try {
        const json = Buffer.from(cursor, 'base64url').toString('utf8');
        decoded = JSON.parse(json);
      } catch {}
    }
    // Use updated_at DESC, name ASC as tie-breaker
    const whereClause = decoded ? `WHERE (updated_at < ? OR (updated_at = ? AND name > ?))` : '';
    const params: any[] = decoded ? [decoded.updated_at, decoded.updated_at, decoded.name] : [];
    const projSql = `SELECT * FROM entities ${whereClause} ORDER BY updated_at DESC, name ASC LIMIT ${capped + 1}`;
    const [projRes, centRes] = await Promise.all([
      this.sqliteManager.executeSql(this.memoryDbName, projSql, params),
      this.sqliteManager.executeSql(this.centralDbPath, projSql, params),
    ]);
    const toEnts = (r: any) => (r.success && r.data) ? r.data.rows.map((row: any) => this.rowToEntity(row)) : [];
    let merged = this.mergeGraphs([{ entities: toEnts(projRes), relations: [] }, { entities: toEnts(centRes), relations: [] }]);
    // Sort merged by updated_at DESC, name ASC and slice
    merged.entities.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name));
    const hasMore = merged.entities.length > capped;
    const page = hasMore ? merged.entities.slice(0, capped) : merged.entities;
    let nextCursor: string | null = null;
    if (hasMore && page.length > 0) {
      const last = page[page.length - 1];
      nextCursor = Buffer.from(JSON.stringify({ updated_at: last.updatedAt, name: last.name })).toString('base64url');
    }
    // Fetch relations for page entities (bounded)
    const names = page.map(e => e.name);
    let relations: Relation[] = [];
    if (names.length > 0) {
      const placeholders = names.map(() => '?').join(',');
      const relSql = `SELECT * FROM relations WHERE from_entity IN (${placeholders}) OR to_entity IN (${placeholders}) LIMIT ${capped * 2}`;
      const relParams = [...names, ...names];
      const [pr, cr] = await Promise.all([
        this.sqliteManager.executeSql(this.memoryDbName, relSql, relParams),
        this.sqliteManager.executeSql(this.centralDbPath, relSql, relParams),
      ]);
      const toRels = (r: any) => (r.success && r.data) ? r.data.rows.map((row: any) => this.rowToRelation(row)) : [];
      relations = [...toRels(pr), ...toRels(cr)];
    }
    return { entities: page, relations, nextCursor };
  }

  private async vecSearchDb(dbName: string, query: string, limit: number): Promise<Entity[]> {
    if (process.env.NODE_ENV === 'test' && !process.env.ENABLE_VECTOR_TEST) return [];
    try {
      const vec = await embedText(query);
      const vecStr = toVecString(vec);
      // vec0 KNN: embedding MATCH vecStr
      const sql = `SELECT e.* FROM entities e JOIN (SELECT rowid, distance FROM vec_entities WHERE embedding MATCH ? ORDER BY distance LIMIT ${limit}) v ON e.rowid = v.rowid`;
      const res = await this.sqliteManager.executeSql(dbName, sql, [vecStr]);
      if (!res.success || !res.data) return [];
      return res.data.rows.map((row: any) => this.rowToEntity(row));
    } catch (e) {
      console.warn(`vec search failed for ${dbName}:`, (e as Error).message);
      return [];
    }
  }

  private async searchRelationsBoth(query: string): Promise<Relation[]> {
    const searchTerm = `%${query.toLowerCase()}%`;
    const relationsQuery = `SELECT * FROM relations WHERE LOWER(relation_type) LIKE ? OR LOWER(from_entity) LIKE ? OR LOWER(to_entity) LIKE ?`;
    const [pr, cr] = await Promise.all([
      this.sqliteManager.executeSql(this.memoryDbName, relationsQuery, [searchTerm, searchTerm, searchTerm]),
      this.sqliteManager.executeSql(this.centralDbPath, relationsQuery, [searchTerm, searchTerm, searchTerm])
    ]);
    const toRels = (r: any) => (r.success && r.data) ? r.data.rows.map((row: any) => this.rowToRelation(row)) : [];
    return [...toRels(pr), ...toRels(cr)];
  }

  async searchNodes(query: string, limit: number = 20, mode: string = 'keyword'): Promise<SearchResult> {
    const cappedLimit = Math.min(Math.max(limit, 1), 100);
    const effMode = (mode as string) || 'keyword';
    if (effMode === 'vector') {
      const [p, c] = await Promise.all([this.vecSearchDb(this.memoryDbName, query, cappedLimit), this.vecSearchDb(this.centralDbPath, query, cappedLimit)]);
      const rels = await this.searchRelationsBoth(query);
      return this.mergeGraphs([{ entities: p, relations: [] }, { entities: c, relations: [] }, { entities: [], relations: rels }]);
    }
    if (effMode === 'hybrid') {
      // FTS + vector RRF
      const fts = await this.searchNodes(query, cappedLimit, 'keyword');
      const vecP = await this.vecSearchDb(this.memoryDbName, query, cappedLimit);
      const vecC = await this.vecSearchDb(this.centralDbPath, query, cappedLimit);
      const vecEntities = [...vecP, ...vecC];
      // RRF k=60
      const k = 60;
      const scores = new Map<string, { e: Entity; score: number }>();
      const ftsList = fts.entities;
      ftsList.forEach((e, i) => {
        const s = 1 / (k + i + 1);
        scores.set(e.name, { e, score: s });
      });
      vecEntities.forEach((e, i) => {
        const s = 1 / (k + i + 1);
        const prev = scores.get(e.name);
        if (prev) prev.score += s;
        else scores.set(e.name, { e, score: s });
      });
      const ranked = [...scores.values()].sort((a, b) => b.score - a.score).slice(0, cappedLimit).map(v => v.e);
      // relations from keyword search
      return { entities: ranked, relations: fts.relations };
    }
    // keyword default
    const sanitizedQuery = query.replace(/[^a-zA-Z0-9_\s]/g, ' ').trim().replace(/\s+/g, ' OR ');
    
    // Fallback to basic LIKE if query is empty after sanitization
    if (!sanitizedQuery) {
      return { entities: [], relations: [] };
    }

    // Search entities using FTS5 BM25 ranking
    const entitiesQuery = `
      SELECT e.* 
      FROM entities e
      JOIN entities_fts fts ON e.rowid = fts.rowid
      WHERE entities_fts MATCH ?
      ORDER BY bm25(entities_fts)
      LIMIT ${cappedLimit}
    `;

    // Relations don't have FTS, keep LIKE but scoped to the sanitized terms
    const searchTerm = `%${query.toLowerCase()}%`;
    const relationsQuery = `
      SELECT * FROM relations
      WHERE LOWER(relation_type) LIKE ? OR LOWER(from_entity) LIKE ? OR LOWER(to_entity) LIKE ?
    `;

    const [projectEntities, projectRelations, centralEntities, centralRelations] = await Promise.all([
      this.sqliteManager.executeSql(this.memoryDbName, entitiesQuery, [sanitizedQuery]),
      this.sqliteManager.executeSql(this.memoryDbName, relationsQuery, [searchTerm, searchTerm, searchTerm]),
      this.sqliteManager.executeSql(this.centralDbPath, entitiesQuery, [sanitizedQuery]),
      this.sqliteManager.executeSql(this.centralDbPath, relationsQuery, [searchTerm, searchTerm, searchTerm])
    ]);

    const toEntities = (result: { success: boolean; data?: any }) =>
      (result.success && result.data) ? result.data.rows.map((row: any) => this.rowToEntity(row)) : [];
    const toRelations = (result: { success: boolean; data?: any }) =>
      (result.success && result.data) ? result.data.rows.map((row: any) => this.rowToRelation(row)) : [];

    return this.mergeGraphs([
      { entities: toEntities(projectEntities), relations: toRelations(projectRelations) },
      { entities: toEntities(centralEntities), relations: toRelations(centralRelations) }
    ]);
  }

  async openNode(name: string): Promise<Entity | null> {
    const result = await this.sqliteManager.queryData(this.memoryDbName, 'entities', { name });
    if (!result.success || !result.data || result.data.rows.length === 0) {
      return null;
    }

    const row = result.data.rows[0];
    return {
      name: row.name,
      entityType: row.entity_type,
      observations: this.safeParseObservations(row.observations),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private safeParseObservations(json: string): string[] {
    try {
      return JSON.parse(json);
    } catch {
      return [];
    }
  }

  async openNodes(names: string[]): Promise<Entity[]> {
    const entities: Entity[] = [];

    for (const name of names) {
      const entity = await this.openNode(name);
      if (entity) {
        entities.push(entity);
      }
    }

    return entities;
  }
}
