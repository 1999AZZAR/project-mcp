---
name: guardian-session
description: "Restore relevant Project Guardian context from memory.db at session start. Use when resuming project work, switching repositories, or answering what was previously in progress; surface active tasks, open bugs, recent observations, and blockers. Can also pull prior sessions from other agent harnesses (opencode, codex, zed, antigravity…) into memory."
---

# Guardian Session — Context Loader

## Purpose

Each session starts fresh. This skill restores context from `memory.db` so you know what's been done, what's in progress, and what needs attention next.

## When to Load

- At the start of every coding session
- When switching between projects
- When resuming work after a break
- When the user says "what was I working on?"

## Core Workflow

### 1. Load Project State

Search for the current project or topic first:
```
search_nodes query="<project-or-topic>"
```

Use `read_graph` only when the graph is known to be small or a full view is explicitly needed. Scan for:
- Project entities (root nodes)
- Active tasks (not marked `[COMPLETE]`)
- Open bugs (not marked `[FIX]`)
- Recent observations (check `updated_at`)

### 2. Contextualize to Current Directory

If working in a subdirectory, search for relevant files:
```
search_nodes query="file:<current-dir>"
```

If working on specific files, search for those:
```
search_nodes query="file:<filename>"
```

### 3. Surface Active Work

Find incomplete tasks:
```
query_data table="entities" conditions={"entity_type": "task"} limit=20
```

Find open bugs:
```
query_data table="entities" conditions={"entity_type": "bug"} limit=10
```

Find recent changes:
```
query_data table="entities" conditions={} orderBy="updated_at" orderDirection="DESC" limit=10
```

### 4. Build Session Summary

Create a mental model of the project state:

```
PROJECT: <name>
├── ACTIVE TASKS: <count>
│   ├── task:<id>:<title> — <status from observations>
│   └── ...
├── OPEN BUGS: <count>
│   ├── bug:<id>:<slug> — <severity>
│   └── ...
├── RECENT CHANGES: <count>
│   ├── <file or entity> — <what changed>
│   └── ...
└── NEXT UP: <suggested next action based on dependencies>
```

### 5. Report to User

Provide a concise briefing:
- What was last worked on (most recent observation)
- What's currently in progress (active tasks)
- What's blocking progress (open bugs, dependency chains)
- Suggested next action

### 6. Pull Cross-Harness Sessions (optional, when prior work may live elsewhere)

Other harnesses keep their own session stores. The bridge reads them **read-only** — it never writes to harness stores or touches harness processes.

```
list_harness_stores
```

Then preview before writing anything:

```
sync_harness_sessions harnesses=["opencode","codex"] project="<current-project>" dryRun=true
```

If the preview looks right, run it for real (omit `dryRun`). Rules:
- Secrets are redacted before anything reaches the graph (`[REDACTED]`); transcripts and binaries are never ingested — titles, summaries, timestamps only.
- Sync is incremental (per-session watermarks) and idempotent: re-running picks up only new or updated sessions.
- Stores absent on this machine (e.g. Cursor/VS Code when not installed) report `found: false` — skip them, don't retry.
- Synced sessions land as `session` entities named `harness:<harness>:<sessionId>`; search them like any other node afterward.

## Context Loading Script

Use `scripts/load_context.py` for automated context extraction:

```bash
python3 $WORKSPACE/skills/guardian-session/scripts/load_context.py [--dir <path>]
```

Output: JSON with project summary, active tasks, recent changes, and suggested next actions.

## Smart Context Detection

### By Working Directory

```python
# If current dir matches a file entity's path
search_nodes query="file:src/"
# → returns all files under src/

# If current dir is the project root
search_nodes query="project:"
# → returns project entities
```

### By File Type

When editing a specific file, load its context:
```
open_node names=["file:<path>"]
```

Then load related entities:
```
search_nodes query="<feature-or-task-name>"
```

### By Recency

Find what changed recently:
```
query_data table="entities" orderBy="updated_at" orderDirection="DESC" limit=5
```

## Dependency Chain Analysis

To find what to work on next, trace dependency chains:

1. Find tasks with no unresolved blockers:
   ```
   search_nodes query="task:"
   ```
2. Check which tasks `depends_on` others
3. Find tasks where all dependencies are complete
4. Those are the next actionable items

## Anti-Patterns

- Don't load the entire graph if only working on a subset
- Don't create session entities for very short interactions (< 5 min)
- Prefer recent observations; include older ones only when they remain active or relevant
- Keep session summaries under 10 lines
