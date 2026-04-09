# [Project Name]

> One sentence: what this project does and for whom.

---

## What This Template Provides

A minimal multi-agent project scaffold with:

- **`AGENTS.md`** — shared operating contract for all agents (roles, task schema, quality gates)
- **`CLAUDE.md`** — Claude Code-specific bridge and permission notes
- **`.claude/settings.json`** — pre-configured tool permissions (deny list for secrets and destructive ops)
- **`.codex/config.toml`** — Codex agent configuration
- **`docs/architecture.md`** — architecture map + inline ADR template
- **`docs/prd/README.md`** — PRD template (copy per feature)
- **`tasks/`** — task registry (`tasks.yaml`)
- **`logs/`** — append-only event log (`events.jsonl`)
- **`scripts/`** — automation helpers

## Quick Start

### Using this template

1. Click **Use this template** on GitHub and create a new repository.
2. Replace this README with your project description.
3. Fill in `AGENTS.md` → **Landmines** and **Tooling** sections with project-specific gotchas.
4. Define your team's roles in `AGENTS.md` → **Roles**.
5. Create `tasks/tasks.yaml` from the schema in `AGENTS.md`.
6. Add your first architectural decision to `docs/architecture.md`.

### Starting a task

1. Add a task entry to `tasks/tasks.yaml`.
2. Claude Squad creates the worktree and opens the agent session automatically.
3. Provide the agent with: `task_id`, worktree path, role.
4. On completion, verify all artifacts exist before marking the task done (see `AGENTS.md` → Quality Gates).

## Repository Layout

```
AGENTS.md                  # Multi-agent operating contract — read first
CLAUDE.md                  # Claude Code bridge
.claude/
  settings.json            # Tool permissions
  agents/                  # Claude-specific subagents
  rules/                   # Project rules (auto-loaded by Claude Code)
  hooks/                   # Claude Code hooks
.codex/
  config.toml              # Codex agent config
docs/
  architecture.md          # System map + ADR log
  prd/
    README.md              # PRD template — copy as feature-slug.md
tasks/                     # tasks.yaml lives here
logs/                      # events.jsonl lives here
scripts/                   # Automation helpers
```

## Secrets

Never commit secrets. Use `.env.local` (gitignored) or your secret manager.
Reference `.env.example` for required variables.
Agents cannot read `.env*` files — enforced by `.claude/settings.json`.
