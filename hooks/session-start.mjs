#!/usr/bin/env node
/**
 * HeLa Genome - Zero-Touch Session Start Hook
 *
 * Modeled after Claude-Mem's Tier 1 Progressive Disclosure:
 * Injects a compact (~50-100 token) session awareness brief
 * containing active tasks, open bugs, and recent changes.
 */

import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

function getDb() {
  const localDb = resolve(process.cwd(), 'memory.db');
  if (existsSync(localDb)) {
    return new DatabaseSync(localDb, { readOnly: true });
  }
  const centralDb = join(homedir(), 'memory', 'memory.db');
  if (existsSync(centralDb)) {
    return new DatabaseSync(centralDb, { readOnly: true });
  }
  return null;
}

try {
  const db = getDb();
  if (!db) {
    console.log('[HELA-GENOME] No active memory.db found for this project.');
    process.exit(0);
  }

  const tasks = db.prepare(`
    SELECT name, observations, updated_at FROM entities 
    WHERE entity_type = 'task' 
    ORDER BY updated_at DESC LIMIT 5
  `).all();

  const bugs = db.prepare(`
    SELECT name, observations, updated_at FROM entities 
    WHERE entity_type = 'bug' 
    ORDER BY updated_at DESC LIMIT 5
  `).all();

  const openTasks = tasks.filter(t => !String(t.observations).includes('[COMPLETE]') && !String(t.observations).includes('[DONE]'));
  const openBugs = bugs.filter(b => !String(b.observations).includes('[FIX]') && !String(b.observations).includes('[RESOLVED]'));

  console.log('--- [HELA-GENOME PROJECT MEMORY BRIEF] ---');
  if (openTasks.length > 0) {
    console.log(`Active Tasks (${openTasks.length}):`);
    openTasks.forEach(t => console.log(`  • ${t.name}`));
  } else {
    console.log('No active blockers or incomplete tasks.');
  }

  if (openBugs.length > 0) {
    console.log(`Open Bugs (${openBugs.length}):`);
    openBugs.forEach(b => console.log(`  ⚠ ${b.name}`));
  }

  console.log('Tip: Use search_nodes(query, detailLevel="compact") or get_file_context(path) for progressive recall.');
  console.log('-------------------------------------------');
  db.close();
} catch {
  // Graceful fallback: never crash agent startup
  process.exit(0);
}
