import { projectGuardianResources, ResourceHandlers } from '../src/resources/resource-registry';
import { MemoryManager } from '../src/memory-manager';
import { SQLiteManager } from '../src/sqlite-manager';
import { existsSync, unlinkSync, rmdirSync, readdirSync } from 'fs';
import { join } from 'path';

describe('ResourceRegistry', () => {
  let sqliteManager: SQLiteManager;
  let memoryManager: MemoryManager;
  let resourceHandlers: ResourceHandlers;
  let testDbPath: string;

  beforeEach(async () => {
    testDbPath = `./test-databases-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sqliteManager = new SQLiteManager(testDbPath);
    memoryManager = new MemoryManager(sqliteManager);
    resourceHandlers = new ResourceHandlers(memoryManager, sqliteManager);

    await memoryManager.initializeMemoryDatabase();
  });

  afterEach(async () => {
    await sqliteManager.closeAllConnections();
    if (existsSync(testDbPath)) {
      const files = readdirSync(testDbPath);
      for (const file of files) {
        if (file.endsWith('.db')) unlinkSync(join(testDbPath, file));
      }
      rmdirSync(testDbPath);
    }
  });

  describe('Resource Listing', () => {
    test('should list all available resources', () => {
      expect(Array.isArray(projectGuardianResources)).toBe(true);
      expect(projectGuardianResources.length).toBeGreaterThan(0);

      projectGuardianResources.forEach(r => {
        expect(r).toHaveProperty('uri');
        expect(r).toHaveProperty('name');
        expect(r).toHaveProperty('description');
        expect(r).toHaveProperty('mimeType');
      });
    });

    test('should have exactly 11 resources', () => {
      expect(projectGuardianResources).toHaveLength(11);
    });

    test('should include expected resource URIs', () => {
      const uris = projectGuardianResources.map(r => r.uri);

      expect(uris).toContain('project-guardian://templates/entity-types');
      expect(uris).toContain('project-guardian://templates/relationship-types');
      expect(uris).toContain('project-guardian://status/current-graph');
      expect(uris).toContain('project-guardian://metrics/project-stats');
      expect(uris).toContain('project-guardian://companions/catalog');
    });
  });

  describe('Resource Reading', () => {
    test('should read entity types template', async () => {
      const result = await resourceHandlers.handleReadResource('project-guardian://templates/entity-types');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('entity');
      expect(result).toContain('project');
    });

    test('should read relationship types template', async () => {
      const result = await resourceHandlers.handleReadResource('project-guardian://templates/relationship-types');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('relationship');
      expect(result).toContain('depends_on');
    });

    test('should read current graph status', async () => {
      const result = await resourceHandlers.handleReadResource('project-guardian://status/current-graph');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      const graph = JSON.parse(result);
      expect(graph).toHaveProperty('entities');
      expect(graph).toHaveProperty('relations');
    });

    test('should read project metrics', async () => {
      const result = await resourceHandlers.handleReadResource('project-guardian://metrics/project-stats');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('statistics');
    });

    test('should read companion catalog', async () => {
      const result = JSON.parse(await resourceHandlers.handleReadResource('project-guardian://companions/catalog'));
      expect(result.companions).toHaveLength(6);
      expect(result.companions.find((item: { id: string }) => item.id === 'guardian-security').tools)
        .toContain('security_scan');
    });

    test('should handle non-existent resource', async () => {
      await expect(resourceHandlers.handleReadResource('project-guardian://non-existent'))
        .rejects.toThrow('Unknown resource: project-guardian://non-existent');
    });
  });
});
