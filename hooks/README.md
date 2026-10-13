# HeLa Genome Lifecycle Hooks

Zero-touch memory capture scripts inspired by the `claude-mem` lifecycle architecture. These hooks eliminate manual overhead by automatically loading context and tracking operations across agent sessions.

## Available Hooks

### 1. `session-start.mjs`
**Role:** Injects a Tier 1 Progressive Disclosure awareness brief at session launch (~50–100 tokens).

- Scans the active project's `memory.db` (or central `~/memory/memory.db` fallback).
- Outputs active (incomplete) tasks, open bugs, and tips for progressive recall.
- Keeps token overhead near zero while preventing agent amnesia.

#### Usage:
```bash
node hooks/session-start.mjs
# or
./hooks/session-start.mjs
```

### 2. `post-tool-run.mjs`
**Role:** Non-blocking capture of file modifications and git status changes directly into `memory.db`.

- Strips `<private>...</private>` tags automatically before saving.
- Can be invoked explicitly by CLI/plugins or automatically inspects git status.

#### Usage:
```bash
# Explicit file edit capture:
./hooks/post-tool-run.mjs --action edit --file "src/auth/jwt.ts" --summary "Added token rotation with <private>SECRET</private>"

# Automatic git status scanner:
./hooks/post-tool-run.mjs
```

## Integrating with Coding Agents

### Claude Code (`~/.claude/settings.json` or Plugin Hook)
Configure hook scripts to trigger automatically on session start and tool execution:
```json
{
  "hooks": {
    "sessionStart": "node /path/to/project-mcp/hooks/session-start.mjs",
    "postToolUse": "node /path/to/project-mcp/hooks/post-tool-run.mjs"
  }
}
```

### Git Post-Commit Hook (`.git/hooks/post-commit`)
Automatically capture commit activity into project memory:
```bash
#!/bin/sh
node /path/to/project-mcp/hooks/post-tool-run.mjs
```
