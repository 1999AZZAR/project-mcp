import { projectGuardianPrompts, PromptHandlers } from '../src/prompts/prompt-registry';
import { MemoryManager } from '../src/memory-manager';
import { SQLiteManager } from '../src/sqlite-manager';
import { existsSync, unlinkSync, rmdirSync, readdirSync } from 'fs';
import { join } from 'path';

describe('PromptRegistry', () => {
  let sqliteManager: SQLiteManager;
  let memoryManager: MemoryManager;
  let promptHandlers: PromptHandlers;
  let testDbPath: string;

  beforeEach(async () => {
    testDbPath = `./test-databases-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sqliteManager = new SQLiteManager(testDbPath);
    memoryManager = new MemoryManager(sqliteManager);
    promptHandlers = new PromptHandlers();

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

  describe('Prompt Listing', () => {
    test('should list all available prompts', () => {
      expect(Array.isArray(projectGuardianPrompts)).toBe(true);
      expect(projectGuardianPrompts.length).toBeGreaterThan(0);

      projectGuardianPrompts.forEach(p => {
        expect(p).toHaveProperty('name');
        expect(p).toHaveProperty('description');
        expect(p).toHaveProperty('arguments');
        expect(Array.isArray(p.arguments)).toBe(true);
      });
    });

    test('should have exactly 27 prompts', () => {
      expect(projectGuardianPrompts).toHaveLength(27);
    });

    test('should include expected prompt names', () => {
      const names = projectGuardianPrompts.map(p => p.name);

      expect(names).toContain('project-setup');
      expect(names).toContain('sprint-planning');
      expect(names).toContain('progress-update');
      expect(names).toContain('code-review');
      expect(names).toContain('bug-tracking');
      expect(names).toContain('release-planning');
    });
  });

  describe('Prompt Handling', () => {
    test('should handle project-setup prompt', async () => {
      const result = await promptHandlers.handleGetPrompt('project-setup', {
        project_name: 'Test Project',
        team_members: 'Alice, Bob, Charlie'
      });

      expect(typeof result).toBe('string');
      expect(result).toContain('Test Project');
    });

    test('should handle prompt with missing arguments', async () => {
      const result = await promptHandlers.handleGetPrompt('project-setup', {});

      expect(typeof result).toBe('string');
      expect(result).toContain('New Project');
    });

    test('should handle sprint-planning prompt', async () => {
      const result = await promptHandlers.handleGetPrompt('sprint-planning', {
        sprint_name: 'Sprint 1',
        duration_days: '14'
      });

      expect(result).toContain('Sprint 1');
    });

    test('should handle every registered prompt', async () => {
      for (const prompt of projectGuardianPrompts) {
        const result = await promptHandlers.handleGetPrompt(prompt.name, {});
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      }
    });

    test('should handle non-existent prompt', async () => {
      await expect(promptHandlers.handleGetPrompt('non-existent-prompt', {}))
        .rejects.toThrow('Unknown prompt: non-existent-prompt');
    });
  });

  describe('Prompt Categories', () => {
    test('should include project management prompts', () => {
      const names = projectGuardianPrompts.map(p => p.name);

      const projectPrompts = [
        'project-setup', 'sprint-planning', 'progress-update', 'retrospective'
      ];

      projectPrompts.forEach(p => {
        expect(names).toContain(p);
      });
    });

    test('should include quality management prompts', () => {
      const names = projectGuardianPrompts.map(p => p.name);

      const qualityPrompts = [
        'code-review', 'bug-tracking', 'technical-debt-assessment'
      ];

      qualityPrompts.forEach(p => {
        expect(names).toContain(p);
      });
    });

    test('should include release management prompts', () => {
      const names = projectGuardianPrompts.map(p => p.name);

      const releasePrompts = [
        'release-planning'
      ];

      releasePrompts.forEach(p => {
        expect(names).toContain(p);
      });
    });
  });
});
