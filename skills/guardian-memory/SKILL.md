---
name: guardian-memory
description: "Maintain project context in Project Guardian's memory.db knowledge graph. Use during coding, debugging, planning, and project-management sessions to restore relevant context and record significant decisions, changes, tasks, and milestones."
---

# Guardian Memory

## Purpose

Every project interaction creates knowledge. This skill ensures nothing is lost. Use Project-Guardian MCP tools to maintain a living knowledge graph of your project in `memory.db`. Every write also mirrors automatically into the central aggregate at `~/memory/memory.db`, so context stays available across projects; call `sync_central_memory` to force a sync on demand.

## Safety

- Never store credentials, tokens, private keys, or sensitive personal data in observations (use `<private>...</private>` tags to ensure sensitive blocks are automatically stripped).
- Ask before any operation that installs hooks, modifies repository files, consolidates databases, or deletes source databases.
- Record significant work only; skip trivial reads, formatting, and transient details.

## Quick Start

### 1. Initialize Project (First Use Only)

```
initialize_memory
```

`initialize_memory` creates the database schema for the active project and ensures the central memory at `~/memory/memory.db` exists. It no longer installs hooks or consolidates databases: use `setup_pre_commit` (with user approval) for hooks, and leave `GUARDIAN_AUTO_MERGE` unset to keep sub-project databases separate.

If the session started outside the project directory, call `set_project_root` with the absolute project path first so memory is written to the right project.

Then create the project root entity:

```
create_entity entities=[{
  "name": "project:<project-name>",
  "entityType": "project",
  "observations": [
    "[INIT] Project created | repo: <repo-url> | stack: <tech-stack>",
    "[CONTEXT] <brief description of project goals>"
  ]
}]
```

### 2. On Every Session Start

Use progressive disclosure to avoid context window bloat:

```
search_nodes query="<file-or-topic>" detailLevel="compact"
```

Or inspect recent chronological project activity:
```
get_timeline limit=10
```

Use `open_node` to retrieve full observation details only on the specific entities needed. Before editing or refactoring an existing project file, run:
```
get_file_context filePath="src/path/to/file.ts"
```

### 3. During Work — Track Everything

After every significant action, record it:

```
add_observation observations=[{
  "entityName": "project:<name>",
  "contents": ["[<timestamp>] action: <what> | impact: <effect> | files: <list>"]
}]
```

## Entity Naming Schema

See `references/entity-schema.md` for detailed examples.

| Type | Pattern | Example |
|------|---------|---------|
| `project` | `project:<name>` | `project:guardian-mcp` |
| `file` | `file:<relative-path>` | `file:src/server.ts` |
| `function` | `func:<file>:<name>` | `func:src/server.ts:createEntity` |
| `task` | `task:<id>:<slug>` | `task:T001:fix-auth-bug` |
| `decision` | `decision:<date>:<slug>` | `decision:2026-07-02:use-sqlite` |
| `bug` | `bug:<id>:<slug>` | `bug:B001:null-pointer` |
| `feature` | `feature:<name>` | `feature:auto-tracking` |
| `milestone` | `milestone:<name>` | `milestone:v1-release` |
| `person` | `person:<name>` | `person:azzar` |
| `resource` | `resource:<name>` | `resource:redis-cache` |
| `risk` | `risk:<slug>` | `risk:data-loss` |

## Relation Schema

See `references/relation-schema.md` for detailed examples and query guidance.

| Relation | Meaning | Example |
|----------|---------|---------|
| `implements` | Code fulfills requirement | `file:auth.ts` → `feature:login` |
| `depends_on` | Task requires another | `task:T002` → `task:T001` |
| `blocks` | Prevents progress | `bug:B001` → `task:T003` |
| `owns` | Person responsible | `person:azzar` → `project:guardian` |
| `relates_to` | General connection | `decision:X` → `feature:Y` |
| `part_of` | Component of | `file:auth.ts` → `feature:auth-system` |
| `precedes` | Must come before | `milestone:v1` → `milestone:v2` |
| `supports` | Enables | `resource:redis` → `feature:caching` |

## Observation Patterns

Use these prefixes for consistent, queryable observations:

```
[<timestamp>] action: <what was done> | impact: <what changed> | files: <list>
[DECISION] chose <A> over <B> | reason: <rationale> | tradeoffs: <list>
[BUG] <error message> | cause: <root cause> | fix: <solution>
[PROGRESS] <percentage> | <milestone> | <blockers if any>
[REVIEW] <feedback summary> | action: <follow-up needed>
[DEPLOY] <environment> | status: <success/fail> | notes: <details>
[REFACTOR] <scope> | reason: <why> | before: <state> | after: <state>
```

## Workflow Templates

### New Feature

1. `create_entity` → `feature:<name>` with goal observations
2. `create_entity` → `task:<id>:<subtask>` for each implementation step
3. `create_relation` → tasks `depends_on` each other sequentially
4. During coding: `create_entity` → `file:<path>` for new files
5. `create_relation` → `file:` `implements` `feature:`
6. After each task: `add_observation` with `[PROGRESS]`

### Bug Fix

1. `create_entity` → `bug:<id>:<slug>` with error details
2. `search_nodes` for related entities
3. `create_relation` → `bug:` `blocks` affected `task:`
4. During investigation: `add_observation` with findings
5. After fix: `add_observation` with `[BUG]` resolution pattern
6. `delete_relation` → remove `blocks` relation

### Sprint Planning

1. `create_entity` → `milestone:<sprint-name>` with date observations
2. `create_entity` → `task:<id>:<title>` for each sprint item
3. `create_relation` → all sprint tasks `part_of` milestone
4. `create_relation` → dependent tasks with `depends_on`
5. `add_observation` → sprint goals and capacity

## New in 2.0.0-beta-2 (Phase 2)

- **Hybrid search** — `search_nodes {query, mode: 'keyword'|'vector'|'hybrid' (default hybrid RRF k=60), limit}` merges FTS BM25 + `vec0` cosine via `all-MiniLM-L6-v2` 384d; use `mode: hybrid` for semantic finds (`GET /api/search?q=&mode=&limit=` also available)
- **Cursor streaming** — for large graphs use `read_graph_stream {cursor, limit 500}` / `GET /api/graph/stream?cursor=&limit=500` (cursor = base64url `{updated_at,name}`), UI auto-streams central 500/page; `read_graph` still supports `limit/offset` 5000 default
- **DB maintenance** — `journal_size_limit 64M` + monthly `VACUUM` via `POST /api/vacuum` (self-schedules 30d)

## Performance Rules

- **Batch entity creation** when setting up (pass array to `create_entity`)
- **Batch relation creation** similarly
- Use `search_nodes` before creating to avoid duplicates
- Use `open_node` to check if entity exists before creating
- Keep observations concise — one line per observation
- Use `query_data` for structured table filtering, ordering, and pagination when `search_nodes` is insufficient

## Integration with Other Skills

- **guardian-tracker**: Automatically creates entities/observations after file edits
- **guardian-session**: Loads context from memory.db at session start
- Both skills use the same naming conventions defined here
