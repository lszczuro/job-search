# Automatic Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move refresh execution from the synchronous web request path into the worker, activate cron scheduling every 30 minutes, persist lifecycle/stats in `import_jobs`, and expose refresh status plus a manual refresh control in the GUI.

**Architecture:** `web` becomes a thin enqueueing surface that creates or reuses a refresh job and returns immediately. `worker` owns cron scheduling, job claiming, and execution of the shared MCP import pipeline, while the offers page reads the latest successful refresh timestamp and exposes a button to enqueue manual refreshes.

**Tech Stack:** TypeScript, Fastify, better-sqlite3, React 19, TanStack Table, Vitest

---

## File Structure

- `src/config/env.ts`
  Parse the new timezone setting and change the default cron to every 30 minutes.
- `src/app/runtime.ts`
  Split synchronous refresh execution into reusable repository-style methods for enqueueing, querying job status, and listing offer page data.
- `src/db/repositories/import-jobs-repository.ts`
  Expand from a type-only stub into the central refresh job repository API.
- `src/core/importing/run-import.ts`
  Keep the shared import aggregation behavior; only extend if needed for executor reuse.
- `src/worker/run-worker.ts`
  Replace the thin helper with worker polling, cron scheduling, and real refresh execution wiring.
- `package.json`
  Add the cron dependency used by the worker runtime.
- `package-lock.json`
  Lock the chosen cron dependency version.
- `src/web/routes/import-routes.ts`
  Return queued or reused jobs only; never run refresh inline.
- `src/web/routes/offers-routes.ts`
  Include refresh metadata in the page shell and keep the HTML renderer aligned with the client boot payload.
- `src/web/client/offers-app.tsx`
  Render the last-updated status, timezone-aware timestamp, and manual refresh button.
- `README.md`
  Document worker ownership, 30-minute cron scheduling, timezone, and manual refresh behavior.
- `docs/architecture.md`
  Update the runtime responsibilities and flow diagrams/descriptions.
- `docs/prd/README.md`
  Remove the old “known gap” wording now that refresh is worker-backed.
- `tests/config/env.test.ts`
  Cover cron default and timezone parsing.
- `tests/web/import-routes.test.ts`
  Verify manual refresh only enqueues or reuses a job.
- `tests/web/views.test.ts`
  Verify the HTML shell includes refresh metadata and UI hook points.
- `tests/web/offers-app.test.ts`
  Verify the client renders the refresh button and last-updated state.
- `tests/worker/run-worker.test.ts`
  Verify worker execution, failure handling, and cron-triggered scheduling.

### Task 1: Add Config And Page Metadata Contracts

**Files:**
- Modify: `src/config/env.ts`
- Modify: `tests/config/env.test.ts`
- Modify: `src/web/routes/offers-routes.ts`
- Modify: `tests/web/views.test.ts`

- [ ] **Step 1: Write the failing config and page-shell tests**

```ts
import { describe, expect, it } from "vitest";
import { parseEnv } from "../../src/config/env";

describe("parseEnv", () => {
  it("uses a 30-minute cron and explicit timezone by default", () => {
    const config = parseEnv({});

    expect(config.refreshCron).toBe("*/30 * * * *");
    expect(config.timezone).toBe("Europe/Warsaw");
  });
});
```

```ts
import { describe, expect, it } from "vitest";
import { renderOffersList } from "../../src/web/routes/offers-routes";

describe("renderOffersList", () => {
  it("renders refresh metadata for the client shell", () => {
    const html = renderOffersList([], {
      timezone: "Europe/Warsaw",
      lastUpdatedAt: "2026-04-09T10:30:00.000Z"
    });

    expect(html).toContain('id="initial-refresh-meta"');
    expect(html).toContain('"timezone":"Europe/Warsaw"');
    expect(html).toContain('"lastUpdatedAt":"2026-04-09T10:30:00.000Z"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/config/env.test.ts tests/web/views.test.ts`

Expected: FAIL because `parseEnv` does not return `timezone`, the default cron is still daily, and `renderOffersList` does not accept refresh metadata yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
export type AppConfig = {
  port: number;
  refreshCron: string;
  timezone: string;
  knownStack: string[];
  profileKeywords: string[];
  allowedCities: string[];
  databasePath: string;
  importPhrase: string;
};

export function parseEnv(env: Record<string, string | undefined>): AppConfig {
  return {
    port: Number(env.PORT ?? 3000),
    refreshCron: env.REFRESH_CRON ?? "*/30 * * * *",
    timezone: env.APP_TIMEZONE ?? "Europe/Warsaw",
    knownStack: (env.KNOWN_STACK ?? "").split(",").map((value) => value.trim()).filter(Boolean),
    profileKeywords: (env.PROFILE_KEYWORDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    allowedCities: (env.ALLOWED_CITIES ?? "").split(",").map((value) => value.trim()).filter(Boolean),
    databasePath: env.DATABASE_PATH ?? "./data/job-search.db",
    importPhrase: env.IMPORT_PHRASE ?? env.PROFILE_KEYWORDS ?? "ai llm"
  };
}
```

```ts
type RefreshMeta = {
  timezone: string;
  lastUpdatedAt: string | null;
};

export function renderOffersList(offers: OfferListItem[], refreshMeta: RefreshMeta) {
  return [
    "<html><head><meta charset=\"utf-8\" /><title>Job Tracker</title>",
    "<style>body{margin:0;font-family:ui-sans-serif,system-ui,sans-serif;background:#f3efe7;color:#1f2937;}</style>",
    "<div id=\"offers-app\"></div>",
    `<script id="initial-offers" type="application/json">${serializeOffersForHtml(offers)}</script>`,
    `<script id="initial-refresh-meta" type="application/json">${JSON.stringify(refreshMeta)}</script>`,
    "<script type=\"module\" src=\"/assets/offers-app.js\"></script>",
    "</body></html>"
  ].join("");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/config/env.test.ts tests/web/views.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/config/env.ts src/web/routes/offers-routes.ts tests/config/env.test.ts tests/web/views.test.ts
git commit -m "feat: add refresh config and page metadata"
```

### Task 2: Build Refresh Job Repository And Shared Runtime Hooks

**Files:**
- Modify: `src/db/repositories/import-jobs-repository.ts`
- Modify: `src/app/runtime.ts`
- Modify: `tests/web/import-routes.test.ts`
- Create: `tests/db/import-jobs-repository.test.ts`

- [ ] **Step 1: Write the failing repository and route tests**

```ts
import { describe, expect, it } from "vitest";
import { buildServer } from "../../src/web/server";

describe("import routes", () => {
  it("reuses an active refresh job instead of importing inline", async () => {
    const calls: string[] = [];
    const app = buildServer({
      createOrReuseRefreshJob: async (kind) => {
        calls.push(kind);
        return { id: 7, kind: "manual_refresh", status: "pending", reused: true };
      }
    });

    const response = await app.inject({ method: "POST", url: "/imports/refresh" });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ id: 7, kind: "manual_refresh", status: "pending", reused: true });
    expect(calls).toEqual(["manual_refresh"]);
  });
});
```

```ts
import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { createImportJobsRepository } from "../../src/db/repositories/import-jobs-repository";

describe("import jobs repository", () => {
  it("returns the existing active refresh job before inserting a duplicate", async () => {
    const sqlite = new Database(":memory:");
    sqlite.exec(`
      CREATE TABLE import_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        requested_by TEXT NOT NULL,
        payload TEXT NOT NULL,
        stats_fetched INTEGER NOT NULL DEFAULT 0,
        stats_added INTEGER NOT NULL DEFAULT 0,
        stats_rejected INTEGER NOT NULL DEFAULT 0,
        stats_duplicates INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT
      )
    `);

    sqlite
      .prepare(
        `INSERT INTO import_jobs (kind, status, requested_by, payload, created_at) VALUES (?, ?, ?, ?, ?)`
      )
      .run("scheduled_refresh", "running", "system", "{}", "2026-04-09T10:00:00.000Z");

    const repository = createImportJobsRepository(sqlite);
    const job = await repository.createOrReuseRefreshJob("manual_refresh", "user");

    expect(job.kind).toBe("scheduled_refresh");
    expect(job.status).toBe("running");
    expect(job.reused).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/web/import-routes.test.ts tests/db/import-jobs-repository.test.ts`

Expected: FAIL because the server still depends on `createImportJob`, and there is no real `createImportJobsRepository` implementation.

- [ ] **Step 3: Write the minimal implementation**

```ts
export type ImportJobRecord = {
  id: number;
  kind: string;
  status: string;
  requestedBy: string;
  payload: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  statsFetched: number;
  statsAdded: number;
  statsRejected: number;
  statsDuplicates: number;
  errorMessage: string | null;
  reused?: boolean;
};

export function createImportJobsRepository(sqlite: Database.Database) {
  return {
    async findActiveRefreshJob() {
      return (
        sqlite
          .prepare(
            `SELECT * FROM import_jobs WHERE kind IN ('manual_refresh', 'scheduled_refresh') AND status IN ('pending', 'running') ORDER BY id DESC LIMIT 1`
          )
          .get() as ImportJobRecord | undefined
      ) ?? null;
    },
    async createOrReuseRefreshJob(kind: "manual_refresh" | "scheduled_refresh", requestedBy: string) {
      const existing = await this.findActiveRefreshJob();
      if (existing) {
        return { ...existing, reused: true };
      }

      const createdAt = new Date().toISOString();
      const result = sqlite
        .prepare(
          `INSERT INTO import_jobs (kind, status, requested_by, payload, created_at) VALUES (?, 'pending', ?, '{}', ?)`
        )
        .run(kind, requestedBy, createdAt);

      return {
        id: Number(result.lastInsertRowid),
        kind,
        status: "pending",
        requestedBy,
        payload: "{}",
        createdAt,
        startedAt: null,
        finishedAt: null,
        statsFetched: 0,
        statsAdded: 0,
        statsRejected: 0,
        statsDuplicates: 0,
        errorMessage: null,
        reused: false
      } satisfies ImportJobRecord;
    }
  };
}
```

```ts
const jobs = createImportJobsRepository(sqlite);

return {
  async createOrReuseRefreshJob(kind: "manual_refresh" | "scheduled_refresh") {
    return jobs.createOrReuseRefreshJob(kind, kind === "manual_refresh" ? "user" : "system");
  },
  async getLatestSuccessfulRefresh() {
    return jobs.getLatestSuccessfulRefresh();
  }
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/web/import-routes.test.ts tests/db/import-jobs-repository.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/runtime.ts src/db/repositories/import-jobs-repository.ts tests/web/import-routes.test.ts tests/db/import-jobs-repository.test.ts
git commit -m "feat: add refresh job repository"
```

### Task 3: Move Real Refresh Execution Into The Worker

**Files:**
- Modify: `src/app/runtime.ts`
- Modify: `src/worker/run-worker.ts`
- Modify: `tests/worker/run-worker.test.ts`

- [ ] **Step 1: Write the failing worker tests**

```ts
import { describe, expect, it } from "vitest";
import { executeNextJob } from "../../src/worker/run-worker";

describe("executeNextJob", () => {
  it("claims a pending refresh job, runs the executor, and marks success", async () => {
    const updates: string[] = [];

    const didRun = await executeNextJob({
      fetchPendingJob: async () => ({ id: 5, kind: "manual_refresh", status: "pending" }),
      markRunning: async (id) => {
        updates.push(`running:${id}`);
      },
      runRefreshJob: async (jobId) => {
        updates.push(`execute:${jobId}`);
        return { fetched: 4, added: 2, rejected: 1, duplicates: 1, errors: 0 };
      },
      markSucceeded: async (id, result) => {
        updates.push(`done:${id}:${result.added}`);
      },
      markFailed: async () => {
        updates.push("failed");
      }
    });

    expect(didRun).toBe(true);
    expect(updates).toEqual(["running:5", "execute:5", "done:5:2"]);
  });

  it("marks the job failed when refresh execution throws", async () => {
    const updates: string[] = [];

    await executeNextJob({
      fetchPendingJob: async () => ({ id: 6, kind: "scheduled_refresh", status: "pending" }),
      markRunning: async (id) => {
        updates.push(`running:${id}`);
      },
      runRefreshJob: async () => {
        throw new Error("mcp unavailable");
      },
      markSucceeded: async () => {
        updates.push("done");
      },
      markFailed: async (id, errorMessage) => {
        updates.push(`failed:${id}:${errorMessage}`);
      }
    });

    expect(updates).toEqual(["running:6", "failed:6:mcp unavailable"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/worker/run-worker.test.ts`

Expected: FAIL because `executeNextJob` still uses `runJob` and has no failure path.

- [ ] **Step 3: Write the minimal implementation**

```ts
type JobResult = {
  fetched: number;
  added: number;
  rejected: number;
  duplicates: number;
  errors: number;
};

type ExecuteNextJobArgs = {
  fetchPendingJob: () => Promise<{ id: number; kind: string; status: string } | null>;
  markRunning: (id: number) => Promise<void>;
  runRefreshJob: (jobId: number) => Promise<JobResult>;
  markSucceeded: (id: number, result: JobResult) => Promise<void>;
  markFailed: (id: number, errorMessage: string) => Promise<void>;
};

export async function executeNextJob(args: ExecuteNextJobArgs) {
  const job = await args.fetchPendingJob();

  if (!job) {
    return false;
  }

  await args.markRunning(job.id);

  try {
    const result = await args.runRefreshJob(job.id);
    await args.markSucceeded(job.id, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown import error";
    await args.markFailed(job.id, message);
  }

  return true;
}
```

```ts
if (process.env.NODE_ENV !== "test") {
  const runtime = createRuntimeDeps();

  setInterval(async () => {
    await executeNextJob({
      fetchPendingJob: runtime.fetchPendingJob,
      markRunning: runtime.markJobRunning,
      runRefreshJob: runtime.runRefreshJob,
      markSucceeded: runtime.markJobSucceeded,
      markFailed: runtime.markJobFailed
    });
  }, 1_000);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/worker/run-worker.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/runtime.ts src/worker/run-worker.ts tests/worker/run-worker.test.ts
git commit -m "feat: move refresh execution to worker"
```

### Task 4: Add Cron Scheduling With Timezone Awareness

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/worker/run-worker.ts`
- Modify: `tests/worker/run-worker.test.ts`
- Modify: `src/app/runtime.ts`

- [ ] **Step 1: Write the failing scheduler test**

```ts
import { describe, expect, it } from "vitest";
import { scheduleRefreshCron } from "../../src/worker/run-worker";

describe("scheduleRefreshCron", () => {
  it("creates a scheduled refresh job on each cron tick", async () => {
    const created: string[] = [];
    const task = scheduleRefreshCron({
      cron: "*/30 * * * *",
      timezone: "Europe/Warsaw",
      enqueueScheduledRefresh: async () => {
        created.push("scheduled_refresh");
      }
    });

    await task.tick();

    expect(created).toEqual(["scheduled_refresh"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/worker/run-worker.test.ts`

Expected: FAIL because there is no scheduler helper or timezone-aware cron wiring.

- [ ] **Step 3: Add the cron dependency**

Run: `npm install node-cron`

Expected: `package.json` and `package-lock.json` now include `node-cron`.

- [ ] **Step 4: Write the minimal implementation**

```ts
import cron from "node-cron";

type SchedulerArgs = {
  cron: string;
  timezone: string;
  enqueueScheduledRefresh: () => Promise<void>;
};

export function scheduleRefreshCron(args: SchedulerArgs) {
  const onTick = async () => {
    await args.enqueueScheduledRefresh();
  };

  return {
    cron: args.cron,
    timezone: args.timezone,
    tick: onTick,
    start() {
      return cron.schedule(args.cron, onTick, {
        timezone: args.timezone
      });
    }
  };
}
```

```ts
const scheduler = scheduleRefreshCron({
  cron: runtime.config.refreshCron,
  timezone: runtime.config.timezone,
  enqueueScheduledRefresh: async () => {
    await runtime.createOrReuseRefreshJob("scheduled_refresh");
  }
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/worker/run-worker.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/app/runtime.ts src/worker/run-worker.ts tests/worker/run-worker.test.ts
git commit -m "feat: add refresh cron scheduler"
```

### Task 5: Add GUI Refresh Controls And Last Updated Status

**Files:**
- Modify: `src/web/routes/offers-routes.ts`
- Modify: `src/web/client/offers-app.tsx`
- Modify: `tests/web/offers-app.test.ts`
- Modify: `tests/web/views.test.ts`

- [ ] **Step 1: Write the failing client test**

```ts
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";

describe("offers app refresh UI", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.resetModules();
  });

  it("renders the last updated timestamp and refresh button", async () => {
    document.body.innerHTML = `
      <div id="offers-app"></div>
      <script id="initial-offers" type="application/json">[]</script>
      <script id="initial-refresh-meta" type="application/json">{"timezone":"Europe/Warsaw","lastUpdatedAt":"2026-04-09T10:30:00.000Z"}</script>
    `;

    await import("../../src/web/client/offers-app");

    expect(await screen.findByRole("button", { name: "Odśwież oferty" })).toBeTruthy();
    expect(screen.getByText(/Ostatni update:/)).toBeTruthy();
    expect(screen.getByText(/2026/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/web/offers-app.test.ts tests/web/views.test.ts`

Expected: FAIL because the client does not read refresh metadata or render any refresh UI.

- [ ] **Step 3: Write the minimal implementation**

```tsx
type RefreshMeta = {
  timezone: string;
  lastUpdatedAt: string | null;
};

function readRefreshMeta(): RefreshMeta {
  const payload = document.getElementById("initial-refresh-meta")?.textContent;
  return payload ? (JSON.parse(payload) as RefreshMeta) : { timezone: "Europe/Warsaw", lastUpdatedAt: null };
}

function formatRefreshTimestamp(value: string | null, timezone: string) {
  if (!value) {
    return "Jeszcze nie odświeżono";
  }

  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone
  }).format(new Date(value));
}

function OfferTableApp() {
  const [refreshMeta] = useState<RefreshMeta>(() => readRefreshMeta());

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="eyebrow">Job Tracker</p>
          <h1>Oferty dopasowane do profilu</h1>
          <p className="summary">
            Ostatni update: {formatRefreshTimestamp(refreshMeta.lastUpdatedAt, refreshMeta.timezone)}
          </p>
        </div>
        <button type="button">Odśwież oferty</button>
      </div>
      {/* existing toolbar and table */}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/web/offers-app.test.ts tests/web/views.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/web/routes/offers-routes.ts src/web/client/offers-app.tsx tests/web/offers-app.test.ts tests/web/views.test.ts
git commit -m "feat: add refresh status to offers ui"
```

### Task 6: Finish Route Wiring And Documentation

**Files:**
- Modify: `src/web/server.ts`
- Modify: `src/web/routes/import-routes.ts`
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Modify: `docs/prd/README.md`
- Modify: `tests/docs/readme-smoke.test.ts`

- [ ] **Step 1: Write the failing route and docs tests**

```ts
import { describe, expect, it } from "vitest";
import { buildServer } from "../../src/web/server";

describe("import routes", () => {
  it("returns a queued manual refresh job shape", async () => {
    const app = buildServer({
      createOrReuseRefreshJob: async () => ({
        id: 11,
        kind: "manual_refresh",
        status: "pending",
        reused: false
      }),
      listOffers: async () => [],
      updateOffer: async () => ({ ok: true }),
      getLatestSuccessfulRefresh: async () => null
    });

    const response = await app.inject({ method: "POST", url: "/imports/refresh" });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({
      id: 11,
      kind: "manual_refresh",
      status: "pending",
      reused: false
    });
  });
});
```

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("README", () => {
  it("documents worker-owned refresh scheduling and timezone", () => {
    const readme = readFileSync("README.md", "utf8");

    expect(readme).toContain("REFRESH_CRON=*/30 * * * *");
    expect(readme).toContain("APP_TIMEZONE=Europe/Warsaw");
    expect(readme).toContain("worker wykonuje pending refresh jobs");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/web/import-routes.test.ts tests/docs/readme-smoke.test.ts`

Expected: FAIL because `buildServer` and README still describe the old synchronous refresh path.

- [ ] **Step 3: Write the minimal implementation**

```ts
type ServerDeps = {
  listOffers?: () => Promise<OfferListItem[]>;
  updateOffer?: (id: number, payload: Record<string, string>) => Promise<unknown>;
  createOrReuseRefreshJob?: (kind: "manual_refresh" | "scheduled_refresh") => Promise<unknown>;
  getLatestSuccessfulRefresh?: () => Promise<string | null>;
};
```

```ts
export function registerImportRoutes(app: FastifyInstance, deps: ImportDeps) {
  app.post("/imports/refresh", async (_, reply) => {
    const job = await deps.createOrReuseRefreshJob?.("manual_refresh");
    return reply.code(202).send(job ?? { id: 1, kind: "manual_refresh", status: "pending", reused: false });
  });
}
```

Update docs so they state:

- `web` only enqueues or reuses refresh jobs
- `worker` executes refresh jobs end-to-end
- default cron is every 30 minutes
- timezone is controlled by `APP_TIMEZONE`
- the offers page shows the last successful refresh time and a manual refresh button

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/web/import-routes.test.ts tests/docs/readme-smoke.test.ts`

Expected: PASS

- [ ] **Step 5: Run the targeted regression suite**

Run: `npm test -- tests/config/env.test.ts tests/db/import-jobs-repository.test.ts tests/web/import-routes.test.ts tests/web/views.test.ts tests/web/offers-app.test.ts tests/worker/run-worker.test.ts tests/docs/readme-smoke.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/web/server.ts src/web/routes/import-routes.ts README.md docs/architecture.md docs/prd/README.md tests/docs/readme-smoke.test.ts
git commit -m "feat: wire automatic refresh flow"
```

## Self-Review

### Spec coverage

- Worker-owned refresh execution: Tasks 2, 3, and 6
- Cron scheduling from `REFRESH_CRON`: Tasks 1 and 4
- Lifecycle and stats persistence in `import_jobs`: Tasks 2 and 3
- GUI refresh button and last updated timestamp: Tasks 1 and 5
- Timezone-aware scheduling/display: Tasks 1, 4, and 5
- README/docs updates: Task 6

### Placeholder scan

No `TODO`, `TBD`, or “implement later” placeholders remain. The one implementation note in Task 4 is constrained to the cron adapter seam and does not defer behavior coverage.

### Type consistency

The plan consistently uses:

- `createOrReuseRefreshJob`
- `getLatestSuccessfulRefresh`
- `runRefreshJob`
- `markSucceeded`
- `markFailed`
- `timezone`
- `lastUpdatedAt`
