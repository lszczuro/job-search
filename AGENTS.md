# AGENTS.md

Operating contract for all agents in this repository.
Read this file before planning or implementing anything.

Before adding any line here, apply this filter:
**"Can the agent find this by reading the code or existing docs?"** — if yes, omit it.

---

## Landmines

> Non-obvious hazards that would cause silent breakage. This is the highest-value section.
> Replace placeholder examples with real project-specific warnings before going live.

<!--
Examples of what belongs here:
- "`legacy/` is still imported by production — do not delete or rename files inside it"
- "Auth uses custom middleware; standard framework patterns silently bypass it"
- "Tests produce false positives unless run with `--no-cache`"
- "Column renames must go through two migrations — single-step renames have caused data loss"
-->

_No landmines documented yet. Add them here as you discover friction._

---

## Tooling

> Only document tools where non-obvious behavior matters.
> Skip anything an agent can infer from `package.json`, `pyproject.toml`, `Makefile`, or similar.

<!--
Example:
| Tool | Non-obvious requirement |
|------|------------------------|
| `uv` | Use instead of pip — direct pip calls bypass the lockfile |
| `just` | Canonical task runner — raw npm/python calls skip pre-hooks |
-->

_No tooling gotchas documented yet._

---

## Roles

> Define who can read and write what. Only include roles that actually exist in your workflow.

<!--
Example:
### `lead`
Plans tasks, maintains `tasks/tasks.yaml`, makes architectural decisions.
Writes to `tasks/` and `docs/` only.

### `implementer`
Executes changes inside an assigned worktree.
Reads assigned scope only. Writes inside assigned worktree only.

### `reviewer`
Read-only. Runs static analysis and diff inspection.
Writes review notes only.
-->

_No roles defined yet._

---

## Task Contract

Tasks live in `tasks/tasks.yaml`. Every task must define:

```yaml
task_id: string
goal: string
depends_on: []
stack: string
owner_role: lead | implementer | reviewer | security
target_paths: []
definition_of_done: string
```

Every completed task must produce:

- diff
- test report
- review notes
- security report (when applicable)
- entries appended to `logs/events.jsonl`
- updated status in `tasks/tasks.yaml`

---

## Quality Gates

**Hard blockers — do not merge:**
- failing tests
- secret or credential leak
- high-severity dependency finding
- missing required task artifact

**Soft blockers — flag, do not block:**
- lint warnings
- unresolved review feedback
- missing documentation update

---

## On-Demand Context

Load only what the current task requires. Do not load everything upfront.

| When you are…                        | Load                    |
|--------------------------------------|-------------------------|
| Making an architectural decision     | `docs/architecture.md`  |
| Scoping or reviewing a feature       | `docs/prd/README.md`    |
