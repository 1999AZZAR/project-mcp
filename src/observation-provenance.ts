/**
 * P1-C2: observation provenance sidecar for project-mcp (Genome).
 *
 * Observations stay bare strings in `entities.observations` (FTS/vec shape
 * unchanged). Externally-sourced facts additionally land in the
 * `observation_provenance` sidecar, keyed by (entity_name, observation,
 * source), mirroring the `HelaProvenanceRef` shape from chaining-mcp
 * (`src/agent/hela-result.ts`). Shape is duplicated (not imported) because
 * each MCP server builds and deploys independently.
 *
 * Best-effort by design: provenance recording never fails the observation
 * write it annotates.
 */

export type ObservationFreshness = 'fresh' | 'cached' | 'stale';

export interface ObservationProvenance {
  /** Canonical URI of the source (page URL, search URL, file path...). */
  source: string;
  /** ISO-8601 timestamp of retrieval. */
  retrieved_at: string;
  /** 0..1 confidence in the sourced fact. */
  confidence?: number;
  /** Retrieval freshness. */
  freshness?: ObservationFreshness;
}

/** Minimal structural surface of SQLiteManager.executeSql (avoids a cycle). */
export interface ProvenanceSqlExecutor {
  executeSql(
    database: string,
    query: string,
    parameters?: any[],
  ): Promise<{ success: boolean; error?: string; data?: any }>;
}

export const OBSERVATION_PROVENANCE_TABLE = 'observation_provenance';

/** Idempotent sidecar schema; safe to call on every startup path. */
export async function ensureObservationProvenanceSchema(
  exec: ProvenanceSqlExecutor,
  dbName: string,
): Promise<void> {
  const r = await exec.executeSql(
    dbName,
    `CREATE TABLE IF NOT EXISTS ${OBSERVATION_PROVENANCE_TABLE} (
      entity_name TEXT NOT NULL,
      observation TEXT NOT NULL,
      source TEXT NOT NULL,
      retrieved_at TEXT NOT NULL,
      confidence REAL,
      freshness TEXT,
      PRIMARY KEY (entity_name, observation, source)
    )`,
  );
  if (!r.success) {
    console.warn('Failed to ensure observation_provenance table:', r.error);
    return;
  }
  const idx = await exec.executeSql(
    dbName,
    `CREATE INDEX IF NOT EXISTS idx_obs_prov_entity ON ${OBSERVATION_PROVENANCE_TABLE}(entity_name)`,
  );
  if (!idx.success) console.warn('Failed to create observation_provenance index:', idx.error);
}

/**
 * Record provenance refs for freshly-written observations. `provenance[i]`
 * annotates `contents[i]`; missing/undefined entries are skipped. Never
 * throws — failures warn and resolve.
 */
export async function recordObservationProvenance(
  exec: ProvenanceSqlExecutor,
  dbName: string,
  entityName: string,
  contents: string[],
  provenance?: Array<ObservationProvenance | undefined>,
): Promise<void> {
  if (!provenance) return;
  try {
    await ensureObservationProvenanceSchema(exec, dbName);
    for (let i = 0; i < contents.length; i++) {
      const ref = provenance[i];
      if (!ref || !ref.source || !ref.retrieved_at) continue;
      const r = await exec.executeSql(
        dbName,
        `INSERT OR REPLACE INTO ${OBSERVATION_PROVENANCE_TABLE}
         (entity_name, observation, source, retrieved_at, confidence, freshness)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [entityName, contents[i], ref.source, ref.retrieved_at, ref.confidence ?? null, ref.freshness ?? null],
      );
      if (!r.success) console.warn(`Provenance record failed for ${entityName}:`, r.error);
    }
  } catch (e) {
    console.warn(`Provenance record failed for ${entityName}:`, (e as Error).message);
  }
}

/** All provenance refs for an entity, grouped by observation text. */
export async function getObservationProvenance(
  exec: ProvenanceSqlExecutor,
  dbName: string,
  entityName: string,
): Promise<Record<string, ObservationProvenance[]>> {
  const grouped: Record<string, ObservationProvenance[]> = {};
  try {
    const r = await exec.executeSql(
      dbName,
      `SELECT observation, source, retrieved_at, confidence, freshness
       FROM ${OBSERVATION_PROVENANCE_TABLE} WHERE entity_name = ?`,
      [entityName],
    );
    if (!r.success || !r.data) return grouped;
    for (const row of r.data.rows as any[]) {
      const ref: ObservationProvenance = {
        source: row.source,
        retrieved_at: row.retrieved_at,
        ...(row.confidence !== null && row.confidence !== undefined ? { confidence: row.confidence } : {}),
        ...(row.freshness ? { freshness: row.freshness as ObservationFreshness } : {}),
      };
      (grouped[row.observation] ??= []).push(ref);
    }
  } catch (e) {
    console.warn(`Provenance read failed for ${entityName}:`, (e as Error).message);
  }
  return grouped;
}
