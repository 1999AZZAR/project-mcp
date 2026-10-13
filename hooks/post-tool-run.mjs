#!/usr/bin/env node
/**
 * HeLa Genome - Zero-Touch Post Tool / Change Capture Hook
 *
 * Modeled after Claude-Mem's PostToolUse Hook:
 * Automatically records file modifications and Git commits into memory.db,
 * freeing the agent or user from remembering to invoke add_observation manually.
 */

import { DatabaseSync } from 'node:sqlite';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

function sanitize(text) {
  return text
    .replace(/<private>[\s\S]*?<\/private>/gi, '[PRIVATE]')
    .replace(/<!--\s*private\s*-->[\s\S]*?<!--\s*\/private\s*-->/gi, '[PRIVATE]');
}

const dbPath = resolve(process.cwd(), 'memory.db');
if (!existsSync(dbPath)) {
  process.exit(0);
}

try {
  const db = new DatabaseSync(dbPath);
  const now = new Date().toISOString();

  // Parse command-line args if provided directly
  const args = process.argv.slice(2);
  let action = 'edit';
  let filePath = null;
  let summary = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--action' && args[i + 1]) action = args[++i];
    if (args[i] === '--file' && args[i + 1]) filePath = args[++i];
    if (args[i] === '--summary' && args[i + 1]) summary = args[++i];
  }

  // If filePath was explicitly passed
  if (filePath) {
    const cleanPath = filePath.replace(/^\.\//, '').trim();
    const entityName = cleanPath.startsWith('file:') ? cleanPath : `file:${cleanPath}`;
    const cleanSummary = sanitize(summary || `Auto-tracked ${action}`);
    const observation = `[${now}] action: ${action} | note: ${cleanSummary}`;

    const existing = db.prepare('SELECT rowid, observations FROM entities WHERE name = ?').get(entityName);
    if (existing) {
      const obsList = JSON.parse(existing.observations || '[]');
      obsList.push(observation);
      db.prepare('UPDATE entities SET observations = ?, updated_at = ? WHERE rowid = ?').run(
        JSON.stringify(obsList),
        now,
        existing.rowid
      );
    } else {
      db.prepare(`
        INSERT INTO entities (name, entity_type, observations, created_at, updated_at)
        VALUES (?, 'file', ?, ?, ?)
      `).run(entityName, JSON.stringify([observation]), now, now);
    }
  } else {
    // Check recent git status changes
    try {
      const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
      if (gitStatus) {
        const lines = gitStatus.split('\n').slice(0, 10);
        for (const line of lines) {
          const match = line.trim().match(/^([MADRCU?]{1,2})\s+(.*)$/);
          if (!match) continue;
          const status = match[1];
          const file = match[2];
          const entityName = `file:${file}`;
          const observation = `[${now}] action: auto-detect | git_status: ${status}`;

          const existing = db.prepare('SELECT rowid, observations FROM entities WHERE name = ?').get(entityName);
          if (existing) {
            const obsList = JSON.parse(existing.observations || '[]');
            const last = obsList[obsList.length - 1] || '';
            if (!last.includes(status)) {
              obsList.push(observation);
              db.prepare('UPDATE entities SET observations = ?, updated_at = ? WHERE rowid = ?').run(
                JSON.stringify(obsList),
                now,
                existing.rowid
              );
            }
          } else {
            db.prepare(`
              INSERT INTO entities (name, entity_type, observations, created_at, updated_at)
              VALUES (?, 'file', ?, ?, ?)
            `).run(entityName, JSON.stringify([observation]), now, now);
          }
        }
      }
    } catch {}
  }

  db.close();
} catch (e) {
  // Never fail parent command
  process.exit(0);
}
