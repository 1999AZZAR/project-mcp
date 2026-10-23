import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { SQLiteManager } from '../src/sqlite-manager.js';
import { MemoryManager } from '../src/memory-manager.js';
import { RequestHandlers } from '../src/handlers/request-handlers.js';
import { ImportExportManager } from '../src/import-export.js';
import { PromptHandlers } from '../src/prompts/prompt-handlers.js';
import { sanitizePrivateContent } from '../src/utils/sanitize.js';
import { Entity, CompactEntity, FileContextResult, TimelineResult, SearchResult } from '../src/types.js';
import { existsSync, unlinkSync, rmdirSync, readdirSync } from 'fs';
import { join } from 'path';

interface ToolResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

describe('Claude-Mem Enhancement Features for HeLa-Genome', () => {
  let sqliteManager: SQLiteManager;
  let memoryManager: MemoryManager;
  let requestHandlers: RequestHandlers;
  let testDbPath: string;

  beforeEach(async () => {
    testDbPath = `./test-databases-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sqliteManager = new SQLiteManager(testDbPath);
    memoryManager = new MemoryManager(sqliteManager);
    const importExportManager = new ImportExportManager(sqliteManager);
    requestHandlers = new RequestHandlers(
      sqliteManager,
      memoryManager,
      importExportManager,
      new PromptHandlers()
    );

    await memoryManager.initializeMemoryDatabase();
  });

  afterEach(async () => {
    await sqliteManager.closeAllConnections();
    try {
      if (existsSync(testDbPath)) {
        const files = readdirSync(testDbPath);
        for (const file of files) {
          if (file.endsWith('.db')) {
            unlinkSync(join(testDbPath, file));
          }
        }
        rmdirSync(testDbPath);
      }
    } catch {
      // Ignore test cleanup errors
      void 0;
    }
  });

  describe('Feature A: Privacy & Guardrails (<private> tags)', () => {
    test('sanitizePrivateContent strips <private> and <!-- private --> blocks', () => {
      const input1 = 'Connected to Redis with password <private>superSecretToken123</private> on port 6379';
      expect(sanitizePrivateContent(input1)).toBe('Connected to Redis with password [PRIVATE] on port 6379');

      const input2 = 'Database config <!-- private -->API_KEY=xyz987654<!-- /private --> active';
      expect(sanitizePrivateContent(input2)).toBe('Database config [PRIVATE] active');

      const multiLine = 'Start\n<private>\nsecret line 1\nsecret line 2\n</private>\nEnd';
      expect(sanitizePrivateContent(multiLine)).toBe('Start\n[PRIVATE]\nEnd');
    });

    test('createEntity strips <private> blocks from observations before saving', async () => {
      const entity = await memoryManager.createEntity('task:auth-service', 'task', [
        'Auth service configured with key <private>secret-api-key-999</private>',
        'Public endpoint setup',
      ]);

      expect(entity.observations[0]).toBe('Auth service configured with key [PRIVATE]');
      expect(entity.observations[0]).not.toContain('secret-api-key-999');

      // Verify persisted row in SQLite
      const fetched = await memoryManager.openNode('task:auth-service');
      expect(fetched).not.toBeNull();
      expect(fetched!.observations[0]).toBe('Auth service configured with key [PRIVATE]');
    });

    test('addObservation strips <private> blocks from new observations', async () => {
      await memoryManager.createEntity('task:db-config', 'task', ['Initial setup']);
      const updated = await memoryManager.addObservation('task:db-config', [
        'Added credentials <!-- private -->PASS=topsecret<!-- /private --> safely',
      ]);

      expect(updated.observations[1]).toBe('Added credentials [PRIVATE] safely');
      expect(updated.observations[1]).not.toContain('PASS=topsecret');
    });
  });

  describe('Feature B: Progressive Disclosure Retrieval (detailLevel)', () => {
    beforeEach(async () => {
      await memoryManager.createEntity('task:jwt-auth', 'task', [
        'Obs 1: Initial research on JWT libraries',
        'Obs 2: Implemented token rotation mechanism',
        'Obs 3: Fixed token expiration edge-case bug in refresh endpoint',
      ]);
      await memoryManager.createEntity('task:oauth-login', 'task', [
        'Obs 1: Google OAuth provider setup',
        'Obs 2: GitHub OAuth integration complete',
      ]);
    });

    test('searchNodes with detailLevel "compact" returns lightweight entities with previews', async () => {
      const result = await memoryManager.searchNodes('jwt', 10, 'keyword', 'compact');
      expect(result.detailLevel).toBe('compact');
      expect(result.entities.length).toBeGreaterThanOrEqual(1);

      const compact = result.entities[0] as CompactEntity;
      expect(compact.name).toBe('task:jwt-auth');
      expect(compact.observationCount).toBe(3);
      expect(compact.preview).toContain('Fixed token expiration edge-case bug');
      expect('observations' in compact).toBe(false); // observations array stripped to conserve context
    });

    test('searchNodes with detailLevel "summary" returns max 2 truncated observations', async () => {
      const result = await memoryManager.searchNodes('jwt', 10, 'keyword', 'summary');
      expect(result.detailLevel).toBe('summary');
      expect(result.entities.length).toBeGreaterThanOrEqual(1);

      const summary = result.entities[0] as Entity;
      expect(summary.name).toBe('task:jwt-auth');
      expect(summary.observations.length).toBe(2);
      expect(summary.observations[0]).toContain('Obs 2');
      expect(summary.observations[1]).toContain('Obs 3');
    });

    test('searchNodes with detailLevel "full" returns full entity graph', async () => {
      const result = await memoryManager.searchNodes('jwt', 10, 'keyword', 'full');
      expect(result.detailLevel).toBe('full');

      const full = result.entities[0] as Entity;
      expect(full.name).toBe('task:jwt-auth');
      expect(full.observations.length).toBe(3);
    });

    test('openNode allows fetching full details on demand after compact search', async () => {
      const searchRes = await memoryManager.searchNodes('jwt', 10, 'keyword', 'compact');
      expect(searchRes.entities[0].name).toBe('task:jwt-auth');

      // Progressive disclosure: follow up with openNode to fetch all 3 observations
      const fullEntity = await memoryManager.openNode('task:jwt-auth');
      expect(fullEntity).not.toBeNull();
      expect(fullEntity!.observations.length).toBe(3);
    });
  });

  describe('Feature C: Fast File Context (get_file_context)', () => {
    test('returns existsInMemory: false when file has not been tracked yet', async () => {
      const fileCtx = await memoryManager.getFileContext('src/nonexistent.ts');
      expect(fileCtx.existsInMemory).toBe(false);
      expect(fileCtx.filePath).toBe('src/nonexistent.ts');
      expect(fileCtx.recentObservations).toEqual([]);
      expect(fileCtx.linkedTasks).toEqual([]);
      expect(fileCtx.linkedBugs).toEqual([]);
    });

    test('resolves file entity with relations, linked tasks, and open bugs', async () => {
      await memoryManager.createEntity('file:src/auth/jwt.ts', 'file', [
        'Created JWT signing helper',
        'Refactored token refresh algorithm',
      ]);
      await memoryManager.createEntity('task:jwt-auth', 'task', ['Auth epic']);
      await memoryManager.createEntity('bug:jwt-leak', 'bug', ['Reported secret leak']);

      await memoryManager.createRelation('task:jwt-auth', 'file:src/auth/jwt.ts', 'implements');
      await memoryManager.createRelation('bug:jwt-leak', 'file:src/auth/jwt.ts', 'affects');

      // Query with relative path without "file:" prefix
      const fileCtx = await memoryManager.getFileContext('src/auth/jwt.ts');
      expect(fileCtx.existsInMemory).toBe(true);
      expect(fileCtx.entityName).toBe('file:src/auth/jwt.ts');
      expect(fileCtx.recentObservations.length).toBe(2);
      expect(fileCtx.linkedTasks).toContain('task:jwt-auth');
      expect(fileCtx.linkedBugs).toContain('bug:jwt-leak');
    });
  });

  describe('Feature D: Chronological Timeline Feed (get_timeline)', () => {
    test('returns chronological events across entities', async () => {
      const now = new Date().toISOString();
      await memoryManager.createEntity('task:step1', 'task', [
        `[${now}] Step 1 initialized`,
      ]);
      await memoryManager.createEntity('task:step2', 'task', [
        `[${now}] Step 2 completed`,
      ]);

      const timeline = await memoryManager.getTimeline({ limit: 10 });
      expect(timeline.entries.length).toBeGreaterThanOrEqual(2);
      expect(timeline.total).toBeGreaterThanOrEqual(2);
      // Newest timestamp first
      expect(timeline.entries[0].timestamp >= timeline.entries[1].timestamp).toBe(true);
    });

    test('filters timeline by entityType', async () => {
      const now = new Date().toISOString();
      await memoryManager.createEntity('task:feature-x', 'task', [`[${now}] Feature X built`]);
      await memoryManager.createEntity('bug:issue-y', 'bug', [`[${now}] Issue Y found`]);

      const taskTimeline = await memoryManager.getTimeline({ entityType: 'task' });
      expect(taskTimeline.entries.every(e => e.entityType === 'task')).toBe(true);
      expect(taskTimeline.entries.some(e => e.entityName === 'task:feature-x')).toBe(true);
      expect(taskTimeline.entries.some(e => e.entityName === 'bug:issue-y')).toBe(false);
    });
  });

  describe('RequestHandlers Tool Integration', () => {
    test('dispatches get_file_context tool call', async () => {
      await memoryManager.createEntity('file:config.json', 'file', ['Config file notes']);
      const res = (await requestHandlers.handleToolCall('get_file_context', {
        filePath: 'config.json',
      })) as ToolResponse<FileContextResult>;

      expect(res.success).toBe(true);
      expect(res.data.existsInMemory).toBe(true);
      expect(res.data.entityName).toBe('file:config.json');
    });

    test('dispatches get_timeline tool call', async () => {
      await memoryManager.createEntity('task:timeline-check', 'task', ['Timeline note']);
      const res = (await requestHandlers.handleToolCall('get_timeline', {
        limit: 5,
      })) as ToolResponse<TimelineResult>;

      expect(res.success).toBe(true);
      expect(res.data.entries).toBeDefined();
    });

    test('dispatches search_nodes with detailLevel="compact"', async () => {
      await memoryManager.createEntity('task:compact-check', 'task', ['Compact obs 1', 'Compact obs 2']);
      const res = (await requestHandlers.handleToolCall('search_nodes', {
        query: 'compact',
        detailLevel: 'compact',
      })) as ToolResponse<SearchResult>;

      expect(res.success).toBe(true);
      expect(res.data.detailLevel).toBe('compact');
      const first = res.data.entities[0] as CompactEntity;
      expect(first.observationCount).toBe(2);
    });
  });
});
