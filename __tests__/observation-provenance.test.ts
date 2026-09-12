import { SQLiteManager } from '../src/sqlite-manager';
import { MemoryManager } from '../src/memory-manager';
import {
  getObservationProvenance,
  ensureObservationProvenanceSchema,
} from '../src/observation-provenance';
import { AddObservationsSchema, CreateEntitiesSchema } from '../src/types';
import { existsSync, unlinkSync, rmdirSync, readdirSync } from 'fs';
import { join } from 'path';

describe('observation provenance sidecar (P1-C2)', () => {
  let sqliteManager: SQLiteManager;
  let memory: MemoryManager;
  let testDbPath: string;

  beforeEach(() => {
    testDbPath = `./test-prov-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    sqliteManager = new SQLiteManager(testDbPath);
    memory = new MemoryManager(sqliteManager, testDbPath);
  });

  afterEach(async () => {
    await sqliteManager.closeAllConnections();
    try {
      if (existsSync(testDbPath)) {
        for (const file of readdirSync(testDbPath)) unlinkSync(join(testDbPath, file));
        rmdirSync(testDbPath);
      }
    } catch { /* ignore cleanup errors */ }
  });

  test('createEntity stores bare strings + sidecar refs', async () => {
    const at = new Date().toISOString();
    const created = await memory.createEntity('srv', 'service', ['runs on :8080', 'owner: team-a'], [
      { source: 'https://en.wikipedia.org/wiki/Server', retrieved_at: at, confidence: 0.9, freshness: 'fresh' },
      undefined,
    ]);
    // bare-string shape unchanged
    expect(created.observations).toEqual(['runs on :8080', 'owner: team-a']);
    const prov = await getObservationProvenance(sqliteManager, 'memory', 'srv');
    expect(Object.keys(prov)).toEqual(['runs on :8080']);
    expect(prov['runs on :8080'][0]).toMatchObject({
      source: 'https://en.wikipedia.org/wiki/Server',
      retrieved_at: at,
      confidence: 0.9,
      freshness: 'fresh',
    });
  });

  test('addObservation without provenance leaves sidecar empty', async () => {
    await memory.createEntity('plain', 'note', ['just a note']);
    await memory.addObservation('plain', ['another note']);
    const prov = await getObservationProvenance(sqliteManager, 'memory', 'plain');
    expect(prov).toEqual({});
  });

  test('schema ensure is idempotent', async () => {
    await ensureObservationProvenanceSchema(sqliteManager, 'memory');
    await ensureObservationProvenanceSchema(sqliteManager, 'memory');
  });

  test('zod schemas accept optional provenance, reject out-of-range confidence', () => {
    const ok = AddObservationsSchema.safeParse({
      observations: [{
        entityName: 'e',
        contents: ['fact'],
        provenance: [{ source: 'https://example.com', retrieved_at: '2026-09-12T00:00:00Z', confidence: 0.5 }],
      }],
    });
    expect(ok.success).toBe(true);
    const bare = AddObservationsSchema.safeParse({
      observations: [{ entityName: 'e', contents: ['fact'] }],
    });
    expect(bare.success).toBe(true);
    const bad = AddObservationsSchema.safeParse({
      observations: [{
        entityName: 'e',
        contents: ['fact'],
        provenance: [{ source: 'https://example.com', retrieved_at: 'x', confidence: 2 }],
      }],
    });
    expect(bad.success).toBe(false);
    const create = CreateEntitiesSchema.safeParse({
      entities: [{ name: 'n', entityType: 't', observations: ['o'] }],
    });
    expect(create.success).toBe(true);
  });
});
