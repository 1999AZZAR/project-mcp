# Project Guardian MCP


> **Part of the [HeLa MCP Ecosystem](https://github.com/1999AZZAR/hela-mcp-ecosystem)** — This server is **HeLa Genome (`hela-genome`)** — the *State & Memory* component of the HeLa cellular architecture. See the [ecosystem docs](https://github.com/1999AZZAR/hela-mcp-ecosystem) for profiles, workflows, and multi-client setup.

A Model Context Protocol (MCP) server for persistent project memory, knowledge-graph operations, SQLite data access, runtime security checks, and guided project-management workflows. The current registry exposes 34 tools, 11 resources, and 27 prompts.

![Blotcat — guardian on duty, wiring the knowledge graph from memory.db](assets/blotcat-hero.jpg)

## Table of Contents

- [Features](#features)
  - [Project Guardian Memory System](#project-guardian-memory-system)
  - [Streamlined Database Operations](#streamlined-database-operations)
  - [Runtime Companion Integration](#runtime-companion-integration)
  - [AI Guidance System](#ai-guidance-system)
  - [Advanced Features](#advanced-features)
  - [Enterprise Features](#enterprise-features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Available Tools](#available-tools)
  - [Database Operations (7 tools)](#database-operations-7-tools)
  - [Memory and Guidance Tools (11 tools)](#memory-and-guidance-tools-11-tools)
  - [Runtime Companion Tools (12 tools)](#runtime-companion-tools-12-tools)
  - [UI Tools (4 tools)](#ui-tools-3-tools)
- [AI Guidance System](#ai-guidance-system)
  - [Available Resources](#available-resources)
  - [Available Prompts](#available-prompts)
  - [How AI Models Use Guidance](#how-ai-models-use-guidance)
- [Usage Examples](#usage-examples)
  - [Project Guardian Setup](#project-guardian-setup)
  - [Project Management Workflow](#project-management-workflow)
  - [Database Operations](#database-operations)
- [Configuration](#configuration)
  - [Optional Runtime Services](#optional-runtime-services)
  - [For Cursor IDE](#for-cursor-ide)
  - [For Claude Desktop](#for-claude-desktop)
- [Project Structure](#project-structure)
- [Development](#development)
- [License](#license)

## Features

### Project Guardian Memory System

![Blotcat pouring a small project memory bucket into a large central memory vat](assets/blotcat-memory-sync.jpg)
- **Knowledge Graph**: Maintain project entities, relationships, and observations
- **Entity Management**: Projects, tasks, people, resources with rich metadata
- **Relationship Mapping**: Dependencies, ownership, blockers, and connections
- **Observation Tracking**: Contextual notes and progress updates
- **Semantic Search**: Fast, localized RAG matching via SQLite's native FTS5 extension (`MATCH` and `bm25()` ranking) across entity names, types, and observations
- **Per-Project Memory**: Each project gets its own `memory.db`. The server resolves the project root in this order: the `GUARDIAN_PROJECT_ROOT` environment variable, then the Git toplevel of its working directory, then `$XDG_DATA_HOME/project-guardian` as a shared fallback outside any Git repository
- **Central Memory Mirror**: Every memory write also syncs into one central database at `~/memory/memory.db`, giving an aggregated, searchable map across all projects and a fallback when a project database is unavailable. Reads through `read_graph` and `search_nodes` merge both stores, with project entries taking precedence
- **Daily Central Backups**: On the first sync of each day, the central database is snapshotted to `~/memory/backup/ddmmyyyy_memory.db`; the seven most recent backups are kept and older ones pruned automatically. On first run, a legacy `~/memory.db` in the home directory is migrated into the new layout and used to seed the first backup
- **On-Demand Pre-Commit Setup**: Nothing is installed at startup. Call `setup_pre_commit` when you want a generated `.pre-commit-config.yaml` and Git hooks in the active project

- **On-Demand Web UI**: Launch a terminal-themed interactive node graph via `start_ui` (and `close_ui`/`stop_ui` to free the port) to visually pan, search, and explore the project state. Desktop-only with mobile gate (`<768px` overlay), always-visible entity browser, clustered amber orbs → expand to cyan per-observation, cursor-streamed `GET /api/graph/stream?cursor=&limit=500` + `react-window` virtual list, `>1k` physics freeze.

### Harness Session Bridge
- **Read-only ingestion from 8 agent harnesses**: `opencode`, `kilocode`, `zed`, `delta`, `antigravity`, `cursor`, `vscode`, `codex`. Sources are opened read-only (SQLite `OPEN_READONLY`, capped JSONL scans) — the bridge never writes to harness stores and never touches harness processes.
- **What's harvested**: session titles, summaries/previews, timestamps, project directories, models, message/step counts. Full transcripts and binaries are never ingested.
- **Secret redaction first**: API keys, tokens, bearer credentials, private keys, and password assignments are replaced with `[REDACTED]` before anything reaches the graph.
- **Incremental + idempotent**: per-session watermarks in a `harness_sync` table — re-runs only pick up new or updated sessions; `dryRun` previews without writing.
- **Absent stores are honest**: harnesses with no local store on the machine (e.g. Cursor/VS Code when not installed) report `found: false` instead of failing. Store paths are overridable via `HARNESS_<ID>_PATH`.

### Streamlined Database Operations

![Blotcat efficiently sorting raw data blocks on a conveyor belt into the structured memory.db SQLite wall](assets/blotcat-db-ops.jpg)
- **Two Stores, One Interface**: Every project uses its own `memory.db`; all seven database tools can also address the central aggregate with `database: "central"`
- **Core CRUD**: Essential database operations (query, insert, update, delete)
- **SQL Execution**: Direct SQL query execution
- **Data Transfer**: Import/export CSV and JSON files
- **34 Tools Total**: Seven database tools, ten memory tools, one guidance tool, twelve runtime companion tools, and four UI/stream tools (`start_ui`, `close_ui`, `stop_ui`, `read_graph_stream`)

### Runtime Companion Integration

![Blotcat acting as a conductor for miniature sub-Blotcats acting as security, memory, and tracker companions](assets/blotcat-companions.jpg)

The repository includes six `guardian-*` AgentSkills and exposes their operational capabilities through typed MCP tools:

| Companion | Runtime role | MCP surface |
| --- | --- | --- |
| `guardian-memory` | Persistent entities, relations, and observations | Ten memory tools |
| `guardian-session` | Active-task, bug, blocker, and recent-change summaries | `get_session_context` |
| `guardian-tracker` | Bounded Git diff and untracked-file analysis | `analyze_git_changes` |
| `guardian-wall` | Untrusted-text normalization and prompt-injection detection | `inspect_untrusted_text` |
| `guardian-security` | Secret scanning and Trivy image scanning | `scan_project_secrets`, `scan_container_image` |
| `guardian-cache` | Optional namespaced Redis storage | Four `cache_*` tools |

AgentSkills provide host-side workflows and instructions. The MCP runtime implements the corresponding operations directly in TypeScript, except container scanning, which invokes Trivy as a bounded external process. No generic script or shell execution tool is exposed.

### AI Guidance System

![Blotcat as an academic master pointing at a glowing scroll of strict rules and project prompts](assets/blotcat-ai-guidance.jpg)
- **11 Resources**: Templates, best practices, project status, and companion capability health
- **27 Prompts**: Comprehensive pre-built workflows for all aspects of project management
- **Expert Guidance**: Step-by-step instructions for complex operations
- **Contextual Help**: Adaptive prompts based on user needs
- **Knowledge Base**: Comprehensive project management wisdom

### Advanced Features
- **Schema Validation**: Comprehensive input validation with Zod schemas
- **Error Handling**: Detailed error messages and graceful failure handling
- **Connection Management**: Bounded 20-connection LRU cache with `WAL` + `synchronous=NORMAL` + `cache_size=-64000` + `journal_size_limit=67108864` + `temp_store=MEMORY` + `busy_timeout=5000`, monthly `VACUUM` (`POST /api/vacuum`) and shutdown cleanup
- **File Integration**: CSV and SQL imports are streamed; CSV writes use bounded string assembly
- **Result Limits & Pagination**: Unbounded raw `SELECT` capped at 10,000 rows; `read_graph`/`readStore` default `5000` with `?limit=&offset=`, `read_graph_stream` cursor `500/page` via `GET /api/graph/stream?cursor=&limit=&` + `POST /api/vacuum`, `search_nodes` capped 100 (hybrid RRF `k=60`)

### Enterprise Features
- **TypeScript**: Fully typed with comprehensive error handling
- **Input Validation**: Zod schema validation for all parameters
- **Error Recovery**: Graceful error handling with detailed error messages
- **Resource Management**: Automatic cleanup of connections and resources
- **Testing**: Ten Jest suites with 93 passing tests (`WAL` + pagination + `close_ui` + `read_graph_stream` + `e2e-vector hybrid`)

## Requirements

- **Node.js**: >= 18.0.0
- **npm**: Latest stable version
- **SQLite3**: Automatically installed as dependency
- **Redis**: Optional; required only for `cache_*` tools through `REDIS_URL`
- **Trivy**: Optional; required only for `scan_container_image`

## Installation

1. **Clone the repository:**
```bash
git clone https://github.com/1999AZZAR/project-mcp.git
cd project-mcp
```

2. **Install dependencies:**
```bash
npm install
```

3. **Build the project:**
Choose between development or production build:

For development (includes source maps and full TypeScript compilation):
```bash
npm run build
```

For production (creates an optimized, minified bundle):
```bash
npm run build:prod
```

4. **Run the test suite:**
```bash
npm test
```

5. **Start the server:**
```bash
npm start
```

### Updating After Changes

When you pull new updates or modify the code, you must rebuild the server and restart your MCP client (Cursor, Claude Desktop, etc.) for the changes to take effect:

1. Pull the latest code: `git pull`
2. Install new dependencies (if any): `npm install`
3. Rebuild the bundle: `npm run build:prod`
4. **Important**: Restart your IDE or the MCP connection so the client can fetch the newly updated tools and prompts.

## Available Tools

![Blotcat opening a large toolbox with three labeled drawers, holding a wrench](assets/blotcat-tool-categories.jpg)

This MCP server currently provides **34 tools**:

### Database Operations (7 tools)

All database tools accept an optional `database` selector: `project` (default) targets the active project's `memory.db`, `central` targets the central aggregate at `~/memory/memory.db`.

#### `execute_sql` - Execute SQL Query
Execute raw SQL queries on the selected memory database.

**Parameters:**
- `query` (required): SQL query string
- `parameters` (optional): Query parameters array
- `database` (optional): `"project"` or `"central"`, default `"project"`

#### `query_data` - Query Table Data
Query memory tables with filtering and pagination.

**Parameters:**
- `table` (required): Table name
- `conditions` (optional): WHERE conditions object
- `limit` (optional): Maximum rows to return
- `offset` (optional): Number of rows to skip
- `orderBy` (optional): Column to sort by
- `orderDirection` (optional): Sort direction ("ASC" or "DESC")
- `database` (optional): `"project"` or `"central"`, default `"project"`

#### `insert_data` - Insert Records
Insert records into a memory table.

**Parameters:**
- `table` (required): Table name
- `records` (required): Array of record objects to insert
- `database` (optional): `"project"` or `"central"`, default `"project"`

#### `update_data` - Update Records
Update records in a memory table.

**Parameters:**
- `table` (required): Table name
- `conditions` (required): WHERE conditions for records to update
- `updates` (required): Fields to update
- `database` (optional): `"project"` or `"central"`, default `"project"`

#### `delete_data` - Delete Records
Delete records from a memory table.

**Parameters:**
- `table` (required): Table name
- `conditions` (required): WHERE conditions for records to delete
- `database` (optional): `"project"` or `"central"`, default `"project"`

#### `import_data` - Import Data
Import data from CSV or JSON file into a memory table.

**Parameters:**
- `table` (required): Target table name
- `filePath` (required): Path to source file
- `format` (optional): File format ("csv" or "json")
- `options` (optional): Import options (delimiter, hasHeader)
- `database` (optional): `"project"` or `"central"`, default `"project"`

#### `export_data` - Export Data
Export memory table data to CSV or JSON file.

**Parameters:**
- `table` (required): Source table name
- `filePath` (required): Output file path
- `format` (optional): Output format ("csv" or "json")
- `conditions` (optional): WHERE conditions to filter export
- `options` (optional): Export options (delimiter, includeHeader)
- `database` (optional): `"project"` or `"central"`, default `"project"`

### Memory and Guidance Tools (13 tools)

#### `initialize_memory` - Initialize Memory System
Set up the project memory database schema and tables.

**Parameters:** None

#### `create_entity` - Create Project Entities
Create entities in the project knowledge graph (supports single or batch).

**Parameters:**
- `entities` (required): Array of entity objects
  - `name`: Entity name
  - `entityType`: Type (project, task, person, resource)
  - `observations`: Array of notes about the entity

#### `create_relation` - Create Entity Relationships
Create relationships between project entities (supports single or batch).

**Parameters:**
- `relations` (required): Array of relation objects
  - `from`: Source entity name
  - `to`: Target entity name
  - `relationType`: Relationship type (depends_on, blocks, owns, etc.)

#### `add_observation` - Add Entity Observations
Add observations/notes to project entities (supports single or batch).

**Parameters:**
- `observations` (required): Array of observation objects
  - `entityName`: Target entity name
  - `contents`: Array of observation strings to add

#### `delete_entity` - Delete Project Entities
Remove entities and their relations from project memory (supports single or batch).

**Parameters:**
- `entityNames` (required): Array of entity names to delete

#### `delete_observation` - Remove Entity Observations
Remove specific observations from entities (supports single or batch).

**Parameters:**
- `deletions` (required): Array of deletion objects
  - `entityName`: Target entity name
  - `observations`: Array of observation strings to remove

#### `delete_relation` - Delete Entity Relationships
Remove relationships between project entities (supports single or batch).

**Parameters:**
- `relations` (required): Array of relation objects to delete
  - `from`: Source entity name
  - `to`: Target entity name
  - `relationType`: Relationship type to delete

#### `read_graph` - Read Project Knowledge Graph
Retrieve the full knowledge graph, merging the active project database with the central aggregate. Project entries win over central entries with the same name. Supports pagination.

**Parameters:**
- `database` (optional): `"project"` (default, merged), `"central"` (only central)
- `limit` (optional, 1-10000, default 5000): Max entities/relations to return, `ORDER BY updated_at DESC`
- `offset` (optional, 0+): Rows to skip

#### `search_nodes` - Search Project Knowledge
Search for entities and relations matching a query across names, types, and content, in both the project database and the central aggregate. Uses FTS5 `MATCH` + `bm25()` ranking.

**Parameters:**
- `query` (required): Search term
- `limit` (optional, 1-100, default 20): Max ranked entities to return

#### `open_node` - Get Entity Details
Retrieve detailed information about project entities (supports single or batch).

**Parameters:**
- `names` (required): Array of entity names to retrieve

#### `list_harness_stores` - List Harness Session Stores
List local agent-harness session stores (opencode, kilocode, zed, delta, antigravity, cursor, vscode, codex): paths, presence, and format notes. Read-only.

**Parameters:** None

#### `sync_harness_sessions` - Sync Harness Sessions Into Memory
Read-only sync of harness sessions (titles, summaries, timestamps; secrets redacted) into the knowledge graph as `session` entities named `harness:<harness>:<sessionId>`. Incremental via watermarks.

**Parameters:**
- `harnesses` (optional): Subset to sync (default: all found)
- `project` (optional): Substring filter on session project/directory
- `since` (optional): Only sessions updated after this ms epoch
- `limit` (optional, 1-500, default 50): Max sessions per harness
- `dryRun` (optional): Report what would sync without writing
- `includeArchived` (optional): Include archived sessions (default false)

#### `get_project_guidance` - Access AI Guidance
Invoke a project guidance framework to receive specialized instructions and checklists for specific workflows. This allows the AI to autonomously fetch and follow established project management protocols.

**Parameters:**
- `guidance_name` (required): Name of the guidance (e.g., project-setup, sprint-planning)
- `arguments` (optional): Arguments required by the specific guidance framework

### Runtime Companion Tools (12 tools)

#### `sync_central_memory`
Copy the active project knowledge graph into the central memory database (`~/memory/memory.db` by default, override with `GUARDIAN_CENTRAL_DB`). Entities are upserted and relations deduplicated, so the central database accumulates a searchable map across all projects. Every memory write also syncs automatically; call this tool to force a sync on demand. The first sync of each day also snapshots the central database and prunes old backups beyond the newest seven.

#### `set_project_root`
Switch the active project memory database to the given absolute project path. Use this at session start when the server was launched outside the project directory, so memory is written to the project instead of the shared fallback database.

- `path` (required): Absolute path to the project root. Inside a Git repository, the toplevel is used.

#### `setup_pre_commit`
Create a `.pre-commit-config.yaml` in the active project root and install the Git hooks, on demand. Requires `pre-commit` to be installed. The generated `.gitignore` entries are intentionally broad: alongside `memory.db`, the block ignores common local tool directories such as `.claude/`, `.vscode/`, `.idea/`, `.gemini/`, and `.cursor/`, plus `.env` files. Entries already present in `.gitignore` are never duplicated. The server never does any of this automatically at startup.

#### `get_session_context`
Summarize active tasks, open bugs, recent changes, blockers, and the next suggested action directly from the knowledge graph.

- `limit` (optional, 1-50, default 10): Maximum entries per result group.

#### `analyze_git_changes`
Return exact machine-readable changed paths from Git, including renames and optionally untracked files.

- `commit` (optional): Analyze one commit against its parent.
- `since` (optional, default `1`): Analyze changes since N commits ago or a Git date.
- `includeUntracked` (optional, default `true`): Include untracked files for worktree analysis.
- `maxFiles` (optional, 1-500, default 100): Bound returned paths.
- `commit` and a custom `since` value are mutually exclusive.

#### `inspect_untrusted_text`
Normalize up to 256 KiB of untrusted text and detect hidden formatting, instruction overrides, role mimicry, hidden HTML/CSS, remote exfiltration markup, and encoded instruction-like content.

- `text` (required): External or otherwise untrusted content.
- Detection is heuristic. Returned normalized text remains untrusted data.

#### `scan_project_secrets`
Scan a workspace-relative file or directory for likely hardcoded credentials. Results contain only type, relative file path, and line number; matched values are never returned.

- `path` (optional, default `.`): Workspace-relative scan target.
- `exclude` (optional): Additional directory names to skip.
- `maxFindings` (optional, 1-500, default 100): Bound findings.
- Absolute paths, traversal, missing paths, and symlink escapes are rejected.

#### `scan_container_image`
Run a timeout-limited Trivy scan and return bounded HIGH/CRITICAL vulnerability summaries.

- `image` (required): Container image reference.
- `maxFindings` (optional, 1-500, default 100): Bound findings.
- Requires Trivy. Image values beginning with `-`, containing whitespace, or containing control characters are rejected.

#### Redis cache tools

- `cache_get`: Read one `mema:<category>:<name>` key.
- `cache_set`: Store a value up to 512 KiB with optional `ttlSeconds` from 1 to 604800.
- `cache_delete`: Delete one namespaced key.
- `cache_scan`: Cursor-scan a `mema:*` pattern with a bounded count.

Project scan paths are restricted to the current Git workspace. Redis tools connect lazily and return an unavailable error when `REDIS_URL` is unset. Container scanning remains unavailable until Trivy is installed. Read `project-guardian://companions/catalog` for current capability health.

### UI Tools (4 tools)

#### `start_ui`
Start the on-demand Project Guardian Web UI server to visually browse the knowledge graph in your browser. It automatically finds a free port (default `3000`, tries `3001…` on collision) and returns the local HTTP URL. The UI serves the CRT-themed force graph from `ui/dist` with correct static-path fallback (`ui/dist` → `MCPservers/.../ui/dist`).

- **Parameters:** None
- **Returns:** `UI Server successfully started on http://localhost:<port>`
- **Features:** Desktop-only (mobile gate at `<768px`), entity browser always visible, observation orbs (clustered amber → expand to cyan), paginated `?limit=&offset=` on `/api/graph/*`.

#### `close_ui` / `stop_ui`
Stop the Web UI server if running and free the port.

- **Parameters:** None
- **Returns:** `UI Server stopped`
- `stop_ui` is an alias for `close_ui`.

## AI Guidance System

Project Guardian MCP includes comprehensive resources and prompts to help AI models effectively use the toolset for project management.

### Available Resources

Project Guardian provides **11 key resources** that AI models can read to understand project management concepts, access capability health, and get comprehensive project insights:

#### `project-guardian://templates/entity-types`
Standard entity types for project management with examples and usage guidelines.

#### `project-guardian://templates/relationship-types`
Common relationship types between project entities with practical examples.

#### `project-guardian://templates/project-workflows`
Standard workflows for using Project Guardian tools in different scenarios.

#### `project-guardian://templates/best-practices`
Comprehensive best practices guide for effective project knowledge management.

#### `project-guardian://status/current-graph`
Current state of the project knowledge graph with summary statistics.

#### `project-guardian://cache/recent-activities`
Recently performed project management activities and updates for tracking progress.

#### `project-guardian://cache/workflow-templates`
Frequently used workflow templates with examples and implementation guidance.

#### `project-guardian://metrics/project-stats`
Statistical overview of project entities, relationships, and activities with health metrics.

#### `project-guardian://cache/team-members`
Cached information about project team members and their roles within the organization.

#### `project-guardian://status/recent-changes`
Recent additions, updates, and modifications to the knowledge graph for audit and monitoring.

#### `project-guardian://companions/catalog`
Lists all six companions, their MCP tools, external prerequisites, and current availability.

### Available Prompts

Project Guardian offers **27 prompts** covering project setup, planning, quality, operations, and incident workflows:

#### Core Project Management
#### `project-setup` - Project Initialization
**Arguments:**
- `project_name` (required): Name of the project
- `team_members` (optional): Comma-separated list of team members

Provides step-by-step guidance for setting up a new project structure with appropriate entities and relationships.

#### `sprint-planning` - Sprint Planning
**Arguments:**
- `sprint_name` (required): Name/number of the sprint
- `duration_days` (optional): Sprint duration in days

Guides through comprehensive sprint planning including task breakdown, dependencies, and capacity planning.

#### `progress-update` - Progress Tracking
**Arguments:**
- `task_name` (required): Name of the task to update
- `progress_notes` (required): Progress update description

Structured process for updating task progress and managing dependencies.

#### `retrospective` - Project Retrospective
**Arguments:**
- `time_period` (required): Time period being reviewed (e.g., "last sprint", "Q1")

Comprehensive retrospective process including data analysis, pattern identification, and improvement action creation.

#### Quality & Process Management
#### `code-review` - Code Review Process
**Arguments:**
- `pull_request_title` (required): Title of the pull request being reviewed
- `reviewer_name` (optional): Name of the reviewer

Structured code review process with technical checklists, issue documentation, and approval workflows.

#### `bug-tracking` - Bug Management
**Arguments:**
- `bug_description` (required): Description of the bug or issue
- `severity_level` (optional): Critical, High, Medium, or Low severity

Complete bug tracking workflow from discovery to resolution with impact analysis and stakeholder communication.

#### `technical-debt-assessment` - Technical Debt Analysis
**Arguments:**
- `component_name` (required): Name of the component or codebase being assessed
- `assessment_scope` (optional): Scope of assessment (file, module, system)

Comprehensive technical debt identification, prioritization, and remediation planning.

#### Release & Deployment Management
#### `release-planning` - Release Planning
**Arguments:**
- `release_version` (required): Version number for the release (e.g., "v2.1.0")
- `release_date` (optional): Target release date

Complete release planning process including quality gates, risk assessment, and deployment coordination.

#### Risk & Change Management
#### `risk-assessment` - Risk Management
**Arguments:**
- `risk_description` (required): Description of the risk
- `impact_level` (optional): High, Medium, or Low impact

Complete workflow for documenting risks, identifying impacts, and developing mitigation strategies.

#### `change-management` - Change Control
**Arguments:**
- `change_description` (required): Description of the proposed change
- `impact_assessment` (optional): High, Medium, or Low impact assessment

Structured change management process with impact analysis, approval workflows, and implementation tracking.

#### Team & Resource Management
#### `team-productivity` - Productivity Analysis
**Arguments:**
- `timeframe` (required): Time period to analyze (week, month, quarter)
- `focus_area` (optional): Area to focus on (velocity, quality, collaboration)

Team productivity assessment with performance metrics, root cause analysis, and improvement planning.

#### `resource-allocation` - Resource Planning
**Arguments:**
- `resource_type` (required): Type of resource (human, infrastructure, budget)
- `planning_horizon` (optional): Planning timeframe (sprint, quarter, year)

Resource allocation optimization with capacity planning, gap analysis, and utilization tracking.

#### Documentation & Communication
#### `stakeholder-communication` - Communication Management
**Arguments:**
- `communication_type` (required): Type of communication (status_update, issue_alert, milestone_reached)
- `audience` (optional): Target audience (team, management, client, all)

Stakeholder communication planning and execution with audience-specific strategies and effectiveness tracking.

#### `documentation-management` - Documentation Updates
**Arguments:**
- `documentation_type` (required): Type of documentation (api, user_guide, technical_spec)
- `update_reason` (optional): Reason for documentation update

Documentation maintenance process with content planning, review workflows, and publishing coordination.

#### Requirements & Planning Management
#### `requirements-gathering` - Requirements Gathering
**Arguments:**
- `requirement_type` (required): Type of requirements (functional, non-functional, business, technical)
- `stakeholders` (optional): Comma-separated list of key stakeholders

Guides through comprehensive requirements gathering process with stakeholder management and requirement categorization.

#### `user-story-management` - User Story Management
**Arguments:**
- `feature_name` (required): Name of the feature or epic
- `user_role` (optional): Primary user role (e.g., "customer", "admin", "developer")

Structured process for creating, managing, and prioritizing user stories with acceptance criteria and dependencies.

#### Quality & Technical Management
#### `testing-strategy` - Testing Strategy Development
**Arguments:**
- `application_type` (required): Type of application (web, mobile, api, desktop)
- `criticality_level` (optional): Business criticality (critical, high, medium, low)

Comprehensive testing strategy development including automated testing, quality gates, and risk-based testing.

#### `security-assessment` - Security Assessment
**Arguments:**
- `assessment_scope` (required): Scope of security assessment (application, infrastructure, data)
- `compliance_requirements` (optional): Compliance standards (GDPR, HIPAA, SOC2, etc.)

Security assessment framework with vulnerability management, compliance verification, and security controls implementation.

#### `performance-optimization` - Performance Optimization
**Arguments:**
- `performance_metric` (required): Primary metric to optimize (response_time, throughput, resource_usage)
- `optimization_goal` (optional): Specific performance target or improvement percentage

Performance monitoring setup, bottleneck identification, and optimization implementation with continuous monitoring.

#### `ci-cd-setup` - CI/CD Pipeline Setup
**Arguments:**
- `pipeline_type` (required): Type of pipeline (build, test, deploy, full_ci_cd)
- `target_platform` (optional): Deployment target (aws, azure, gcp, kubernetes, heroku)

Complete CI/CD pipeline setup including quality gates, rollback procedures, and security integration.

#### `architecture-review` - Architecture Review
**Arguments:**
- `architecture_type` (required): Type of architecture (microservices, monolithic, serverless, hybrid)
- `review_focus` (optional): Primary focus area (scalability, security, maintainability, performance)

Architectural assessment framework with design pattern analysis, technology stack evaluation, and improvement recommendations.

#### Knowledge & Team Management
#### `knowledge-transfer` - Knowledge Transfer
**Arguments:**
- `knowledge_domain` (required): Domain of knowledge (technical, process, business)
- `transfer_recipients` (optional): Who needs to receive the knowledge (team, individual, department)

Knowledge transfer planning and execution with session management, documentation, and effectiveness validation.

#### `vendor-management` - Vendor Management
**Arguments:**
- `vendor_type` (required): Type of vendor service (cloud, development, consulting, infrastructure)
- `contract_value` (optional): Contract value range (small, medium, large, enterprise)

Vendor relationship management including contract tracking, performance monitoring, and cost optimization.

#### Incident & Crisis Management
#### `incident-response` - Incident Response
**Arguments:**
- `incident_severity` (required): Severity level (critical, high, medium, low)
- `incident_type` (optional): Type of incident (security, performance, functionality, availability)

Incident response framework with containment, recovery, root cause analysis, and post-incident review.

#### Financial & Resource Management
#### `cost-management` - Cost Management
**Arguments:**
- `cost_category` (required): Primary cost category (infrastructure, personnel, tools, licenses)
- `budget_constraint` (optional): Budget constraint level (strict, flexible, unlimited)

Cost monitoring, optimization strategies, and budget management with forecasting and reporting.

#### Customer & Innovation Management
#### `customer-feedback` - Customer Feedback Management
**Arguments:**
- `feedback_channel` (required): Primary feedback channel (survey, support, reviews, analytics)
- `feedback_focus` (optional): Focus area (usability, features, performance, support)

Customer feedback collection, analysis, and action planning with continuous improvement cycles.

#### `innovation-planning` - Innovation Planning
**Arguments:**
- `innovation_type` (required): Type of innovation (product, process, technology, business_model)
- `risk_tolerance` (optional): Risk tolerance level (conservative, moderate, aggressive)

Innovation management framework with idea generation, experimentation, and success measurement.

### How AI Models Use Guidance

1. **Discovery**: List available resources and prompts to understand capabilities
2. **Learning**: Read relevant resources to understand project management concepts
3. **Planning**: Use appropriate prompts for complex workflows
4. **Execution**: Follow structured guidance to use tools effectively
5. **Verification**: Check results and iterate as needed
This guidance system ensures AI models can provide expert-level project management assistance using the Project Guardian toolset.

### Behavioral Protocol (System Rules)

Every `prompts/get` response from this MCP server includes a shared **Behavioral Protocol** as a system message (implemented in `src/prompts/behavioral-protocol.ts`). This protocol enforces:

- Minimal, production-ready, self-documenting code with a security-first approach.
- No buzzwords, unnecessary emoji, or filler; direct, technically accurate answers.
- Adaptive response depth based on the user's request (quick answers vs. complex breakdowns).
- Consistent use of validated best practices for systems, programming, UI/UX, and design.

Clients integrating this MCP server should treat the first system message as the governing rules for any downstream model that uses these prompts.

## Usage Examples

![Blotcat routing prompts and tools into memory.db](assets/blotcat-workflow.jpg)

### Project Guardian Setup

```typescript
// Initialize the project memory system
const initResult = await mcpClient.callTool('initialize_memory', {});

// Create your first project entities
const entityResult = await mcpClient.callTool('create_entity', {
  entities: [
    {
      name: 'web_platform',
      entityType: 'project',
      observations: ['Main web application platform', 'React + Node.js stack', 'Q2 2024 delivery']
    },
    {
      name: 'user_authentication',
      entityType: 'feature',
      observations: ['OAuth2 implementation', 'Google/GitHub providers', 'JWT tokens']
    }
  ]
});

// Establish project relationships
const relationResult = await mcpClient.callTool('create_relation', {
  relations: [
    {
      from: 'user_authentication',
      to: 'web_platform',
      relationType: 'part_of'
    }
  ]
});
```

### Project Management Workflow

```typescript
// Add progress observations
await mcpClient.callTool('add_observation', {
  observations: [
    {
      entityName: 'user_authentication',
      contents: [
        'Completed OAuth2 setup for Google provider',
        'JWT implementation finished',
        'Unit tests passing at 95% coverage'
      ]
    }
  ]
});

// Search project knowledge
const searchResult = await mcpClient.callTool('search_nodes', {
  query: 'authentication'
});

// Read entire project knowledge graph
const graphResult = await mcpClient.callTool('read_graph', {});

// Get detailed entity information
const entityDetails = await mcpClient.callTool('open_node', {
  names: ['user_authentication', 'web_platform']
});
```

### Database Operations

```typescript
// Execute custom SQL queries
const sqlResult = await mcpClient.callTool('execute_sql', {
  query: 'SELECT * FROM entities WHERE entity_type = ?',
  parameters: ['project']
});

// Query project data
const queryResult = await mcpClient.callTool('query_data', {
  table: 'entities',
  conditions: { entity_type: 'task' },
  limit: 10
});

// Import/export data
const importResult = await mcpClient.callTool('import_data', {
  table: 'project_data',
  filePath: './project_backup.csv',
  format: 'csv'
});
```

## Configuration

![Blotcat plugging a giant power cord into a wall socket](assets/blotcat-configuration.jpg)

### Environment Variables

The server reads these variables at startup:

| Variable | Default | Purpose |
| --- | --- | --- |
| `GUARDIAN_PROJECT_ROOT` | unset | Absolute path to the project root. When set, `memory.db` is stored here instead of relying on Git detection |
| `GUARDIAN_CENTRAL_DB` | `~/memory/memory.db` | Absolute path to the central memory database that every project syncs into. Backups are written to a `backup/` directory next to it |
| `GUARDIAN_AUTO_MERGE` | unset | Set to `1` to enable scattered-database consolidation at startup. This merges nested `memory.db` files into the project-root database and deletes them, so leave it unset when sub-projects keep separate memories |
| `REDIS_URL` | unset | Enables the Redis-backed `cache_*` tools |
| `XDG_DATA_HOME` | platform default | Base directory for the shared fallback database outside a Git repository |
| `HELA_GENOME_ALLOW_SQL_WRITE` | *unset = off* | Set to `true` to allow `execute_sql` writes. Reads (`SELECT`/`WITH`/`PRAGMA`/`EXPLAIN`) always allowed. |
| `HELA_GENOME_ALLOW_DESTRUCTIVE` | *unset = off* | Set to `true` to allow `delete_data` and `setup_pre_commit` (Git hook install). |
| `HELA_ENVELOPE` | *unset = off* | Set to `true` to wrap tool results in the canonical HeLaResult envelope (`ok/summary/data/artifacts/provenance/warnings/sideEffects/execution`). Off = byte-identical legacy output. Run/step ids propagate from `HELA_RUN_ID`/`HELA_STEP_ID`. |

MCP clients launch servers with their own working directory, which is often your home folder rather than the project you are editing. In that situation Git detection cannot find the project and every session writes to the shared fallback database. Two ways to fix this:

1. Set `GUARDIAN_PROJECT_ROOT` in the project's MCP configuration (see the client examples below).
2. Call the `set_project_root` tool with the absolute project path at session start — no configuration edits needed. The switch applies to the running server; set the environment variable if you want it to apply automatically to every future session.

### Optional Runtime Services

Redis is optional and is never contacted during startup. Configure it only when cache tools are needed:

```json
{
  "env": {
    "REDIS_URL": "redis://localhost:6379/0"
  }
}
```

Trivy is discovered from `PATH` when `scan_container_image` is called. Missing Redis or Trivy affects only its associated tools; memory, database, guidance, session, Git, wall, and project-secret tools remain available.

The companion catalog reports `available`, `optional`, or `unavailable` for each runtime capability. The server uses stdio transport and does not expose an HTTP listener.

### For Cursor IDE

Add this server to your Cursor MCP configuration (`~/.cursor/mcp.json`). Replace the `GUARDIAN_PROJECT_ROOT` value with the project this configuration belongs to:

```json
{
  "mcpServers": {
    "project-guardian": {
      "command": "node",
      "args": ["/path/to/project-mcp/dist/index.js"],
      "env": {
        "GUARDIAN_PROJECT_ROOT": "/path/to/your/project"
      }
    }
  }
}
```

### For Claude Desktop

Add this server to your Claude Desktop configuration (`claude_desktop_config.json`), following the same pattern:

```json
{
  "mcpServers": {
    "project-guardian": {
      "command": "node",
      "args": ["/path/to/project-mcp/dist/index.js"],
      "env": {
        "GUARDIAN_PROJECT_ROOT": "/path/to/your/project"
      }
    }
  }
}
```

## Project Structure

```
project-mcp/
├── src/
│   ├── index.ts              # Main entry point
│   ├── server.ts             # MCP server orchestrator
│   ├── memory-manager.ts     # Knowledge graph and FTS5 RAG semantic search
│   ├── sqlite-manager.ts     # Database operations and connection management
│   ├── import-export.ts      # CSV/JSON data import and export functionality
│   ├── ui-manager.ts         # On-Demand Web UI server and port finder
│   ├── types.ts              # TypeScript type definitions and schemas
│   ├── handlers/
│   │   └── request-handlers.ts # Central tool execution dispatcher
│   ├── tools/
│   │   ├── tool-registry.ts     # Tool definitions and listing
│   │   ├── database-tools.ts    # Database operation tool schemas
│   │   ├── memory-tools.ts      # Memory management tool schemas
│   │   ├── guidance-tools.ts    # Guidance tool schema
│   │   └── runtime-tools.ts     # Companion runtime tool schemas
│   ├── runtime/
│   │   ├── path-guard.ts        # Workspace path containment
│   │   └── runtime-capabilities.ts # Native companion implementations
│   ├── resources/
│   │   ├── resource-registry.ts  # Resource definitions and handlers
│   │   ├── resource-definitions.ts # Static resource metadata
│   │   ├── resource-handlers.ts   # Dynamic resource content generation
│   │   └── companion-catalog.ts   # Companion capability health
│   └── prompts/
│       ├── prompt-registry.ts       # Prompt definitions and handlers
│       ├── prompt-definitions.ts    # Static prompt metadata
│       ├── prompt-handlers.ts       # Dynamic prompt content generation
│       └── behavioral-protocol.ts   # Shared Behavioral Protocol system prompt
├── ui/                       # On-Demand Web UI frontend (Vite/React)
│   ├── src/
│   │   ├── App.tsx           # Main CRT-themed node graph visualization
│   │   ├── main.tsx          # React DOM entry point
│   │   └── index.css         # Styling, CRT scanlines, and CSS variables
│   └── vite.config.ts        # Vite build configuration
├── __tests__/                # Comprehensive test suite
│   ├── tool-registry.test.ts
│   ├── resource-registry.test.ts
│   ├── prompt-registry.test.ts
│   ├── request-handlers.test.ts
│   ├── runtime-capabilities.test.ts
│   ├── import-export.test.ts
│   ├── sqlite-manager.test.ts
│   └── bug-fixes.test.ts
├── skills/                   # Six distributable guardian-* AgentSkills
├── dist/                     # Ignored production build output
├── memory.db                 # Ignored local SQLite state, created on first run
├── package.json              # Project dependencies and scripts
├── package.prod.json         # Production-only dependencies for smaller bundle
├── tsconfig.json            # TypeScript configuration
├── jest.config.js           # Test configuration
└── README.md                # This documentation
```

### Key Components

- **server.ts**: MCP server lifecycle, transport, handlers, and shutdown coordination
- **handlers/request-handlers.ts**: Central dispatcher routing tool calls to appropriate managers
- **tools/**: Tool definition and registration system (34 tools total)
  - `tool-registry.ts`: Lists all available tools (7 DB + 10 memory + 1 guidance + 12 runtime + 3 UI)
  - `database-tools.ts`: Database operation schemas (7 tools)
  - `memory-tools.ts`: Memory management schemas (10 tools)
  - `guidance-tools.ts`: Autonomous guidance tool schema (1 tool)
  - `runtime-tools.ts`: Typed companion capability schemas (12 tools)
- **runtime/**: Workspace guards and companion runtime implementations
- **resources/**: Resource management system (11 resources total)
  - `resource-registry.ts`: Resource listing and content serving
  - `resource-definitions.ts`: Static resource metadata
  - `resource-handlers.ts`: Dynamic content generation
- **prompts/**: Prompt management system (27 prompts total)
  - `prompt-registry.ts`: Prompt listing and content serving
  - `prompt-definitions.ts`: Static prompt metadata
  - `prompt-handlers.ts`: Dynamic prompt generation with context
  - `behavioral-protocol.ts`: Centralized Behavioral Protocol system message used by all prompts
- **memory-manager.ts**: Knowledge graph operations for entities, relationships, and observations
- **sqlite-manager.ts**: Database abstraction with bounded connection caching and schema management
- **import-export.ts**: CSV, JSON, and SQL data transfer utilities
- **types.ts**: Zod schemas for input validation and TypeScript type safety
- **skills/**: Agent-side workflows, scripts, references, and assets for the six companion packages

### Local State

`memory.db` and its `memory.db-*` sidecars are runtime state and are ignored by Git. Each project keeps its own database at its resolved project root (see [Environment Variables](#environment-variables)); projects outside any Git repository without an explicit root share the fallback database under `$XDG_DATA_HOME/project-guardian`. In addition, every memory write mirrors into the central database at `~/memory/memory.db`, which is a merge across projects: deleting an entity in one project does not remove it from the central copy, so treat the central database as a searchable aggregate rather than a per-project backup. Daily snapshots live in `~/memory/backup/`. A clone starts with no project memory; the server creates the database and schema locally on first run. Back up or export memory explicitly when it must move between machines. Never commit the database because observations can contain private project context.

The database tools (`execute_sql`, `query_data`, `insert_data`, `update_data`, `delete_data`, `import_data`, `export_data`) accept a `database` selector: `project` (default) targets the active project database, `central` targets the aggregate.

## Development

1. **Clone the repository:**
```bash
git clone https://github.com/1999AZZAR/project-mcp.git
cd project-mcp
```

2. **Install dependencies:**
```bash
npm install
```

3. **Build the project:**
For active development (with file watching):
```bash
npm run dev
```

For a standard build:
```bash
npm run build
```

For a production-optimized build:
```bash
npm run build:prod
```

4. **Run tests:**
```bash
npm test
```

5. **Start the server:**
```bash
npm start
```

## License

MIT License - see LICENSE file for details.
