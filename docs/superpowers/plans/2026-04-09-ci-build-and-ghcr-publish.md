# CI Build And GHCR Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GitHub Actions build-and-publish automation that pushes `latest` from `main` and pushes semver container tags to `ghcr.io` from git tags shaped like `vX.Y.Z`.

**Architecture:** Keep the scope narrow: one GitHub Actions workflow handles both trigger types and switches tag behavior based on the Git ref. Add smoke-level repo tests that read the workflow file as text, then update README so the release model is documented and stays covered by tests.

**Tech Stack:** GitHub Actions, Docker Buildx, GHCR, Node.js, TypeScript, Vitest

---

## File Structure

- `.github/workflows/publish.yml`
  New workflow file that runs on pushes to `main` and version tags, validates the project, computes image tags, and publishes to `ghcr.io`.
- `tests/docs/github-actions-smoke.test.ts`
  New smoke test that locks down workflow triggers, validation commands, registry target, permissions, and tag logic.
- `README.md`
  Add a short CI/CD section describing `latest` from `main` and semver tags from git release tags.
- `tests/docs/readme-smoke.test.ts`
  Extend the existing README smoke test so CI/CD documentation becomes part of the repo contract.

### Task 1: Add Workflow Coverage Before YAML

**Files:**
- Create: `tests/docs/github-actions-smoke.test.ts`
- Create: `.github/workflows/publish.yml`

- [ ] **Step 1: Write the failing workflow smoke test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GitHub Actions publish workflow", () => {
  it("publishes latest from main and semver tags from git tags", () => {
    const workflow = readFileSync(".github/workflows/publish.yml", "utf8");

    expect(workflow).toContain("branches:");
    expect(workflow).toContain("- main");
    expect(workflow).toContain("tags:");
    expect(workflow).toContain("- 'v*.*.*'");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("packages: write");
    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("npm test");
    expect(workflow).toContain("npm run build");
    expect(workflow).toContain("ghcr.io");
    expect(workflow).toContain("type=raw,value=latest,enable={{is_default_branch}}");
    expect(workflow).toContain("type=match,pattern=v(.*),group=1");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/docs/github-actions-smoke.test.ts`

Expected: FAIL with an `ENOENT` error because `.github/workflows/publish.yml` does not exist yet.

- [ ] **Step 3: Write the minimal workflow implementation**

```yaml
name: Publish Container

on:
  push:
    branches:
      - main
    tags:
      - 'v*.*.*'

permissions:
  contents: read
  packages: write

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build application
        run: npm run build

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract Docker metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=raw,value=latest,enable={{is_default_branch}}
            type=match,pattern=v(.*),group=1

      - name: Build and push image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: ./Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/docs/github-actions-smoke.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/docs/github-actions-smoke.test.ts .github/workflows/publish.yml
git commit -m "ci: publish container to ghcr"
```

### Task 2: Document The Release Model And Lock It With Tests

**Files:**
- Modify: `README.md`
- Modify: `tests/docs/readme-smoke.test.ts`

- [ ] **Step 1: Extend the failing README smoke test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("README", () => {
  it("documents web, worker, timezone, migration commands, and CI container publishing", () => {
    const readme = readFileSync("README.md", "utf8");

    expect(readme).toContain("npm run web");
    expect(readme).toContain("npm run worker");
    expect(readme).toContain("npm run db:migrate");
    expect(readme).toContain("APP_TIMEZONE=Europe/Warsaw");
    expect(readme).toContain("worker wykonuje pending refresh jobs");
    expect(readme).toContain("ghcr.io");
    expect(readme).toContain("latest");
    expect(readme).toContain("vX.Y.Z");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/docs/readme-smoke.test.ts`

Expected: FAIL because `README.md` does not document GHCR publication or the `latest`/`vX.Y.Z` tagging rules yet.

- [ ] **Step 3: Write the minimal documentation update**

```md
## CI / publikacja obrazu

Repo publikuje obraz kontenera do `ghcr.io` przez GitHub Actions.

- push do `main` buduje projekt i publikuje tag `latest`
- push taga git w formacie `vX.Y.Z` buduje projekt i publikuje tag obrazu `X.Y.Z`

Workflow przed publikacją wykonuje:

- `npm ci`
- `npm test`
- `npm run build`
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/docs/readme-smoke.test.ts`

Expected: PASS

- [ ] **Step 5: Run the focused regression suite**

Run: `npm test -- tests/docs/github-actions-smoke.test.ts tests/docs/readme-smoke.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add README.md tests/docs/readme-smoke.test.ts
git commit -m "docs: describe ghcr publish flow"
```

### Task 3: Final Verification And Task Artifacts

**Files:**
- Modify: `tasks/tasks.yaml`
- Modify: `tasks/test-report-ci-build-and-ghcr-publish.md`
- Modify: `tasks/review-ci-build-and-ghcr-publish.md`
- Modify: `tasks/security-ci-build-and-ghcr-publish.md`
- Modify: `logs/events.jsonl`

- [ ] **Step 1: Add the task entry before implementation finishes**

```yaml
- task_id: ci-build-and-ghcr-publish
  goal: Build the project on GitHub and publish the container image to ghcr.io with latest from main and semver tags from git releases.
  depends_on: []
  stack: typescript
  owner_role: implementer
  target_paths:
    - .github/workflows/publish.yml
    - tests/docs/github-actions-smoke.test.ts
    - README.md
    - tests/docs/readme-smoke.test.ts
  definition_of_done: Pushes to main publish latest, pushes of vX.Y.Z tags publish semver tags, and the release model is covered by repo tests and documentation.
  status: in_progress
  artifacts:
    spec: docs/superpowers/specs/2026-04-09-ci-build-and-ghcr-publish-design.md
    plan: docs/superpowers/plans/2026-04-09-ci-build-and-ghcr-publish.md
    test_report: tasks/test-report-ci-build-and-ghcr-publish.md
    review_notes: tasks/review-ci-build-and-ghcr-publish.md
    security_report: tasks/security-ci-build-and-ghcr-publish.md
    event_log: logs/events.jsonl
```

- [ ] **Step 2: Run full verification after implementation**

Run: `npm test`

Expected: PASS

Run: `npm run build`

Expected: PASS

- [ ] **Step 3: Write the required task artifacts**

```md
# Test Report: CI Build And GHCR Publish

- `npm test`
- `npm run build`
- focused docs/workflow smoke coverage passed
```

```md
# Review Notes: CI Build And GHCR Publish

- workflow trigger shape matches the approved design
- latest is limited to `main`
- semver tags come only from git tags matching `vX.Y.Z`
```

```md
# Security Report: CI Build And GHCR Publish

- publishing uses `GITHUB_TOKEN`
- workflow permissions are limited to `contents: read` and `packages: write`
- no long-lived registry secret added to the repository
```

- [ ] **Step 4: Append lifecycle events and mark the task completed**

```json
{"timestamp":"2026-04-09T15:00:00.000Z","task_id":"ci-build-and-ghcr-publish","event":"implementation_started","status":"in_progress"}
{"timestamp":"2026-04-09T15:20:00.000Z","task_id":"ci-build-and-ghcr-publish","event":"implementation_completed","status":"completed","verification":{"tests":"npm test","build":"npm run build"}}
```

```yaml
status: completed
```

- [ ] **Step 5: Commit**

```bash
git add tasks/tasks.yaml tasks/test-report-ci-build-and-ghcr-publish.md tasks/review-ci-build-and-ghcr-publish.md tasks/security-ci-build-and-ghcr-publish.md logs/events.jsonl
git commit -m "chore: record ci publish task artifacts"
```
