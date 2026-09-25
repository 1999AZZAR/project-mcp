---
name: code-reviewer
description: Unified code, bug, and security review skill. Use when asked for code review, PR review, security review, bugbot logic inspection, or merge approval decisions across local changes, branches, commits, or GitHub pull requests.
---

# Code Reviewer

Unified review skill combining functional correctness, logic bug detection, and defensive security auditing.

## Review Modes

Support the requested review focus:

1. **Standard (Default)**: General review assessing functional correctness, breaking changes, test coverage, and regressions.
2. **Security**: Threat modeling, trust boundaries, injection, authorization, authentication, secret exposure, and data validation.
3. **Bugbot**: Algorithmic bugs, off-by-one errors, concurrency hazards, race conditions, edge-case failure handling, and state invariant violations.
4. **Interactive Dispatch**: When the user requests a general `/review`, determine whether to perform a full standard review or focus specifically on Security or Bugbot.

---

## Workflow

### 1. Scope Determination

- **GitHub PR**: Resolve repository, base SHA, and head SHA with `gh pr view`, `gh pr checks`, and `gh pr diff`. Inspect metadata, checks, and the changed-file list.
- **Local Branch**: Compare against the default base branch (`main` or `master`) or configured upstream. Calculate merge-base to branch tip diff.
- **Commit or Git Range**: Preserve exact endpoints (`<base>..<head>` or `<base>...<head>`).
- **Uncommitted Changes**: Review staged and unstaged working tree changes. State the chosen scope before reporting findings.

### 2. Context Building

- Read changed files in full, not just diff hunks.
- Trace dependent callers, types, schemas, migrations, and existing tests.
- Verify diff completeness against deleted, renamed, binary, and submodule files.
- Never analyze working tree files as PR revision files if the PR branch is not checked out.

### 3. Inspection Checklist by Category

#### Functional Correctness & Regressions (Standard Mode)
- Broken invariants, incorrect business logic, and backward-incompatible API changes.
- Unhandled edge cases, missing null/undefined guards, and off-by-one errors.
- Missing unit or integration tests for changed behavior and failure branches.

#### Security & Trust Boundaries (Security Mode)
- Injection vulnerabilities (SQL, command, template, LDAP, regex denial of service).
- Authentication and authorization bypasses; broken object-level authorization (BOLA).
- Hardcoded secrets, unmasked sensitive data in logs, and credential exposure.
- Insecure deserialization, path traversal, and unsafe external input processing.
- Missing CSRF, CORS misconfigurations, and improper cryptographic primitives.

#### Concurrency, State & Reliability (Bugbot Mode)
- Deadlocks, race conditions, uncoordinated state mutations, and thread safety.
- Resource leaks (unclosed sockets, database connections, file descriptors).
- Failure path handling, uncaught promises, missing rollback logic, and data loss risks.
- Performance regressions on high-volume or unbounded inputs.

---

## Verification

Run relevant project-native verification commands (linters, typecheckers, test suites) against the reviewed revision when safe and non-mutating:
- Discover commands from project configuration (`package.json`, `Makefile`, `Cargo.toml`, `pyproject.toml`).
- Never run mutating commands (e.g., `git reset`, `git checkout --`, or auto-fix formatters) during review.
- Report executed commands and outcomes alongside findings.

---

## Output Format

Report actionable findings first, ordered from highest to lowest severity:

| Severity | Location (`file:line`) | Issue Description | Suggested Fix |
| :--- | :--- | :--- | :--- |
| Critical | `path/to/file.ext:42` | Short defect summary describing failure trigger and impact. | Concrete architectural or code remediation direction. |
| High | `path/to/file.ext:88` | ... | ... |
| Medium | `path/to/file.ext:105` | ... | ... |
| Low | `path/to/file.ext:14` | ... | ... |

- **No speculative findings**: Only report defects with plausible execution paths and observable impact.
- **No style-only nitpicks**: Ignore formatting preferences unless they conceal a functional defect or violate an explicit project linter rule.
- **Summary**: End with residual test gaps, assumptions, and an explicit verdict: `Approve` or `Request changes`. Any unresolved Critical or High finding requires `Request changes`.

---

## Subagent Delegation (Optional)

When the environment supports dedicated subagents (`bugbot` or `security-review`) and the user specifically requests subagent execution:
- Launch `subagent_type: "bugbot"` or `subagent_type: "security-review"`.
- Provide `Full Repository Path`, `Diff` (`branch changes` or `uncommitted changes`), and optional `Base Branch`.
- Format subagent results into the standard findings table upon completion.
