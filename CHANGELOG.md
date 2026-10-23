# Changelog

All notable changes to Project Guardian MCP.

## [Unreleased]

### Fixed
- **`read_graph_stream` dispatch** — the tool was registered and documented but missing from the memory dispatch list, causing `Unknown tool`; added regression coverage.
- **`set_project_root` schema init** — switching roots now resets the schema-ready flag so the new project database is initialized before writes.
- **Unicode search** — `search_nodes` keeps letters and numbers in any script instead of stripping non-ASCII characters.
- **Missing guidance handlers** — `release-planning` and `risk-assessment` now return prompts like the other 25 frameworks.
- **Read-only SQL results** — `execute_sql` now returns rows for `PRAGMA`, `EXPLAIN`, `VALUES`, and CTE (`WITH`) queries instead of only `SELECT`.

### Security
- **Workspace path guard** — `import_data`/`export_data` reject absolute and traversal paths by default; opt out with `HELA_GENOME_ALLOW_EXTERNAL_PATHS=true`.
- **Identifier validation** — table, condition, update, and order column names are validated before interpolation into SQL.
- **Raw SQL write guard** — CTE writes and write-capable `PRAGMA` statements are rejected unless `HELA_GENOME_ALLOW_SQL_WRITE=true`; read-only PRAGMAs remain allowed.

## [2.0.0-beta-3] - 2026-10-14

### Added
- **Claude-Mem: Progressive Disclosure Retrieval** — `search_nodes` with `detailLevel: compact|summary|full` (compact yields ~50 tokens/entity with `observationCount` and preview).
- **Claude-Mem: Pre-file Context** — new MCP tool `get_file_context` (38 tools total, was 36) to look up prior modifications, linked tasks (`implements`), and linked bugs before file edits.
- **Claude-Mem: Chronological Timeline** — new MCP tool `get_timeline` with `entityType` and `since` temporal filters.
- **Claude-Mem: Privacy Guardrails** — automated stripping of `<private>...</private>` and `<!-- private -->` tags before SQLite storage or vector embedding.
- **Claude-Mem: Zero-Touch Lifecycle Hooks** — `hooks/session-start.mjs` (Tier 1 session brief) and `hooks/post-tool-run.mjs` (automatic git/edit observation capture via built-in `node:sqlite`).
- **Tests** — 14 test suites, 139 passing tests (added `__tests__/claude-mem-features.test.ts`).

## [2.0.0-beta-2] - 2026-08-27

### Added
- **Scale: Cursor streaming** — `readGraphStream(cursor base64url {updated_at,name}, limit 500 cap 1000)` + `MCP read_graph_stream` + `GET /api/graph/stream?cursor=&limit=` (34 tools total, was 33) + `POST /api/vacuum` (`fa033ec`/`c2dd6ca`/`e43ca01`)
- **UI: Virtual + streaming LOD** — `react-window 1.8.11` `FixedSizeList 420h 56h` for `>50` entities (was 50-slice SHOW MORE), central view incremental streaming 500/page, auto-collapse `>300` (cluster) `>400` disable orbs (`c2dd6ca`)
- **UI: >1k physics freeze** — `cooldownTicks 0 d3AlphaDecay 1 d3VelocityDecay 1` when `nodes>1000` (deck.gl WebGL TODO for 10k)
- **DB: VACUUM + journal cap** — `PRAGMA journal_size_limit=67108864` (64M) + `vacuumDatabase()` + `vacuumDatabases()` self-schedule 30d (`fa033ec`)

### Changed
- **UI bundle** — `index-B2DK7m-f.js 403k` (was `COU8SsoH.js` 391k / `B2DK7m-f` after phase2)
- **E2E** — `93/93` still pass (10 suites), `GET /api/graph/stream` + `POST /api/vacuum` + `hybrid search vector` + `stream pagination` verified live

## [2.0.0-beta-1] - 2026-08-27

### Added
- **Vector Hybrid RAG (POC)** — `sqlite-vec` `vec0(embedding float[384])` + `@xenova/transformers` `all-MiniLM-L6-v2` local 384d (`2772572`), `vector-manager.ts` lazy pipeline, `ensureProjectSchema`/`ensureCentralSchema` vec table + `createRequire` Jest fix
- **MCP: `search_nodes` hybrid** — `mode: keyword|vector|hybrid` (default `hybrid` RRF `k=60` merging FTS BM25 + vec cosine), `vectorSearch` KNN `MATCH`, `GET /api/search?q=&mode=&limit=` (`673a238`)
- **UI: Hybrid search** — `SEARCH ENTITIES` now `fetch /api/search` when `q≥2` with `HYBRID|KEYWORD|VECTOR` select, `filteredNodes = searchResults ?? baseFiltered` (`COU8SsoH.js`)
- **Backfill** — `scripts/backfill_vec.mjs` real embeddings `central 105` + `project 76` vec rows
- **E2E** — `__tests__/e2e-vector.test.ts` `2/2` pass, `93/93` total, mock `Float32Array` realm fix

### Fixed
- **Jest vec load** — `import.meta.resolve` failure via `createRequire` fallback for `sqlite-vec` (`b4d4b1d`)

## [1.1.0] - 2026-08-26

### Added
- **UI: Observation orbs** — each observation as cyan hollow orb, amber clustered per-entity with expand/collapse (`ec4bb7f`), default `false` (`8529a36`), expand-all/collapse-all
- **UI: Always-visible entity browser** — persistent A-Z list filtered by name/group with `obs•links` counts (`2d93547`)
- **UI: Desktop-only gate** — mobile overlay at `<768px` or `<1024px+touch` with blur backdrop (`0398ef8`)
- **MCP: `close_ui` / `stop_ui`** — mirror `start_ui`, 33 tools total (was 31) (`4268fcb`)
- **API: Pagination** — `readStore`/`readGraph` `{limit,offset}` (default 5000, validated), `searchNodes` `limit` (20 default, 100 cap), `GET /api/graph/:view?limit=&offset=` (`e6872cd`)
- **DB: WAL** — `journal_mode=WAL`, `synchronous=NORMAL`, `cache_size=-64000`, `temp_store=MEMORY`, `busy_timeout=5000` per connection

### Fixed
- **UI 404** — `join(process.cwd(),'ui','dist')` fallback to `MCPservers/.../ui/dist` + SPA fallback (`e736e1c`)
- **UI layout** — right panel flex sibling (was absolute overlay) → no out-of-screen graph (`c2085a3`)
- **Memory: `no such table: entities`** — lazy `ensureProjectSchema()` on fresh 0-byte DB (`6f1f712`)
- **Memory: Batch transactions** — `syncToCentral` + bulk `createEntities/createRelations/addObservations` single `BEGIN/COMMIT`, `sqlite insertData` batch (100 rows 8ms)

### Security
- **Audit 24→0** — `sqlite3 5.1.7→6.0.1`, `@typescript-eslint/parser+plugin 6→8` (`e6872cd`)

### Docs
- **README** synced to 33 tools (7 DB +10 memory +1 guidance +12 runtime +3 UI), 9 suites 91 tests, WAL/pagination notes (`13621ae`)

## [1.0.0] - prior
- Initial 31 tools, 11 resources, 27 prompts, FTS5, central mirror `~/memory/memory.db`, daily backup, pre-commit on-demand.
