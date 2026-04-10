# Nfty Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send one nfty notification after a successful worker refresh run when at least one new offer was added, with optional click-through URL from env.

**Architecture:** Extend env parsing with optional nfty settings, expose a small runtime helper that builds and sends the nfty request, and call that helper from the worker success path before marking the job succeeded. Notification delivery remains best-effort: refresh success is determined by import execution, not by outbound notification success.

**Tech Stack:** TypeScript, Node.js fetch API, Fastify runtime helpers, Vitest

---

## File Structure

- `src/config/env.ts`
  Parse optional nfty configuration and expose it in `AppConfig`.
- `src/app/runtime.ts`
  Add a focused `publishNftyNotification` helper and pass parsed config into it.
- `src/worker/run-worker.ts`
  Trigger nfty publication after successful refresh execution and swallow notification delivery failures.
- `.env.example`
  Document optional nfty variables.
- `README.md`
  Document when notifications are sent and how to configure them.
- `tests/config/env.test.ts`
  Cover parsing of optional nfty variables.
- `tests/worker/run-worker.test.ts`
  Cover skip, success, and failure-isolated notification behavior.
- `tests/app/runtime.test.ts`
  Cover request construction for Basic Auth, body text, and click URL header.

### Task 1: Add Nfty Config And Runtime Helper

**Files:**
- Modify: `src/config/env.ts`
- Modify: `src/app/runtime.ts`
- Modify: `tests/config/env.test.ts`
- Create: `tests/app/runtime.test.ts`

- [ ] **Step 1: Write the failing env and runtime helper tests**

```ts
import { describe, expect, it } from "vitest";
import { parseEnv } from "../../src/config/env";

describe("parseEnv", () => {
  it("parses optional nfty configuration", () => {
    const config = parseEnv({
      NFTY_ENDPOINT: "https://nfty.sh/job-search",
      NFTY_LOGIN: "alice",
      NFTY_PASSWORD: "secret",
      NFTY_CLICK_URL: "https://job-search.local/offers"
    });

    expect(config.nfty).toEqual({
      endpoint: "https://nfty.sh/job-search",
      login: "alice",
      password: "secret",
      clickUrl: "https://job-search.local/offers"
    });
  });
});
```

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRuntimeDeps } from "../../src/app/runtime";

describe("publishNftyNotification", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("sends one authenticated nfty request with click URL when enabled", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const runtime = createRuntimeDeps({
      DATABASE_PATH: ":memory:",
      NFTY_ENDPOINT: "https://nfty.sh/job-search",
      NFTY_LOGIN: "alice",
      NFTY_PASSWORD: "secret",
      NFTY_CLICK_URL: "https://job-search.local/offers"
    });

    await runtime.publishNftyNotification(3);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://nfty.sh/job-search",
      expect.objectContaining({
        method: "POST",
        body: "Znaleziono 3 nowe oferty",
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from("alice:secret").toString("base64")}`,
          Click: "https://job-search.local/offers"
        })
      })
    );
  });

  it("does nothing when nfty is disabled", async () => {
    const runtime = createRuntimeDeps({ DATABASE_PATH: ":memory:" });

    await runtime.publishNftyNotification(2);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/config/env.test.ts tests/app/runtime.test.ts`

Expected: FAIL because `parseEnv` does not expose `nfty` config and `createRuntimeDeps` does not provide `publishNftyNotification`.

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
  nfty: {
    endpoint: string | null;
    login: string | null;
    password: string | null;
    clickUrl: string | null;
  };
};
```

```ts
export function parseEnv(env: Record<string, string | undefined>): AppConfig {
  return {
    port: Number(env.PORT ?? 3000),
    refreshCron: env.REFRESH_CRON ?? "*/30 * * * *",
    timezone: env.APP_TIMEZONE ?? "Europe/Warsaw",
    knownStack: (env.KNOWN_STACK ?? "").split(",").map((value) => value.trim()).filter(Boolean),
    profileKeywords: (env.PROFILE_KEYWORDS ?? "").split(",").map((value) => value.trim()).filter(Boolean),
    allowedCities: (env.ALLOWED_CITIES ?? "").split(",").map((value) => value.trim()).filter(Boolean),
    databasePath: env.DATABASE_PATH ?? "./data/job-search.db",
    importPhrase: env.IMPORT_PHRASE ?? env.PROFILE_KEYWORDS ?? "ai llm",
    nfty: {
      endpoint: env.NFTY_ENDPOINT ?? null,
      login: env.NFTY_LOGIN ?? null,
      password: env.NFTY_PASSWORD ?? null,
      clickUrl: env.NFTY_CLICK_URL ?? null
    }
  };
}
```

```ts
function getNftyMessage(added: number) {
  return added === 1 ? "Znaleziono 1 nową ofertę" : `Znaleziono ${added} nowe oferty`;
}

async function publishNftyNotification(config: AppConfig["nfty"], added: number) {
  if (!config.endpoint || !config.login || !config.password || added <= 0) {
    return;
  }

  const headers: Record<string, string> = {
    Authorization: `Basic ${Buffer.from(`${config.login}:${config.password}`).toString("base64")}`
  };

  if (config.clickUrl) {
    headers.Click = config.clickUrl;
  }

  await fetch(config.endpoint, {
    method: "POST",
    body: getNftyMessage(added),
    headers
  });
}
```

```ts
const config = parseEnv(env);

return {
  refreshCron: config.refreshCron,
  timezone: config.timezone,
  async publishNftyNotification(added: number) {
    await publishNftyNotification(config.nfty, added);
  }
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/config/env.test.ts tests/app/runtime.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/config/env.ts src/app/runtime.ts tests/config/env.test.ts tests/app/runtime.test.ts
git commit -m "feat: add nfty notification runtime helper"
```

### Task 2: Trigger Notifications From Worker Without Failing Refresh Jobs

**Files:**
- Modify: `src/worker/run-worker.ts`
- Modify: `tests/worker/run-worker.test.ts`

- [ ] **Step 1: Write the failing worker tests**

```ts
import { describe, expect, it } from "vitest";
import { executeNextJob } from "../../src/worker/run-worker";

describe("executeNextJob notifications", () => {
  it("publishes one nfty notification when a refresh adds new offers", async () => {
    const updates: string[] = [];

    await executeNextJob({
      fetchPendingJob: async () => ({ id: 1, kind: "manual_refresh", status: "pending" }),
      markRunning: async (id) => {
        updates.push(`running:${id}`);
      },
      runRefreshJob: async () => ({
        fetched: 5,
        added: 3,
        rejected: 1,
        duplicates: 1,
        errors: 0
      }),
      publishNotification: async (added) => {
        updates.push(`notify:${added}`);
      },
      markSucceeded: async (id, result) => {
        updates.push(`done:${id}:${result.added}`);
      },
      markFailed: async (id, errorMessage) => {
        updates.push(`failed:${id}:${errorMessage}`);
      }
    });

    expect(updates).toEqual(["running:1", "notify:3", "done:1:3"]);
  });

  it("still marks the job succeeded when nfty delivery fails", async () => {
    const updates: string[] = [];

    await executeNextJob({
      fetchPendingJob: async () => ({ id: 2, kind: "manual_refresh", status: "pending" }),
      markRunning: async (id) => {
        updates.push(`running:${id}`);
      },
      runRefreshJob: async () => ({
        fetched: 2,
        added: 1,
        rejected: 0,
        duplicates: 1,
        errors: 0
      }),
      publishNotification: async () => {
        throw new Error("nfty unavailable");
      },
      markSucceeded: async (id, result) => {
        updates.push(`done:${id}:${result.added}`);
      },
      markFailed: async (id, errorMessage) => {
        updates.push(`failed:${id}:${errorMessage}`);
      }
    });

    expect(updates).toEqual(["running:2", "done:2:1"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/worker/run-worker.test.ts`

Expected: FAIL because `executeNextJob` does not accept `publishNotification` and never attempts notification delivery.

- [ ] **Step 3: Write the minimal implementation**

```ts
type ExecuteNextJobArgs = {
  fetchPendingJob: () => Promise<{ id: number; kind: string; status: string } | null>;
  markRunning: (id: number) => Promise<void>;
  runRefreshJob: (jobId: number) => Promise<JobResult>;
  publishNotification: (added: number) => Promise<void>;
  markSucceeded: (id: number, result: JobResult) => Promise<void>;
  markFailed: (id: number, errorMessage: string) => Promise<void>;
};
```

```ts
try {
  const result = await args.runRefreshJob(job.id);

  try {
    await args.publishNotification(result.added);
  } catch (error) {
    console.error("Failed to publish nfty notification", error);
  }

  await args.markSucceeded(job.id, result);
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : "Unknown import error";
  await args.markFailed(job.id, errorMessage);
}
```

```ts
await executeNextJob({
  fetchPendingJob: runtime.fetchPendingJob,
  markRunning: runtime.markJobRunning,
  runRefreshJob: runtime.runRefreshJob,
  publishNotification: runtime.publishNftyNotification,
  markSucceeded: runtime.markJobSucceeded,
  markFailed: runtime.markJobFailed
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/worker/run-worker.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/worker/run-worker.ts tests/worker/run-worker.test.ts
git commit -m "feat: publish nfty notifications from worker"
```

### Task 3: Document Nfty Configuration And Run Full Verification

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `tests/docs/readme-smoke.test.ts`

- [ ] **Step 1: Write the failing documentation smoke test**

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("README smoke", () => {
  it("documents nfty notifications and their env variables", () => {
    const readme = readFileSync("README.md", "utf8");

    expect(readme).toContain("NFTY_ENDPOINT");
    expect(readme).toContain("NFTY_LOGIN");
    expect(readme).toContain("NFTY_PASSWORD");
    expect(readme).toContain("NFTY_CLICK_URL");
    expect(readme).toContain("jedną notyfikację nfty");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/docs/readme-smoke.test.ts`

Expected: FAIL because README does not mention nfty configuration yet.

- [ ] **Step 3: Write the minimal documentation updates**

```env
NFTY_ENDPOINT=
NFTY_LOGIN=
NFTY_PASSWORD=
NFTY_CLICK_URL=
```

```md
- `NFTY_ENDPOINT`: opcjonalny endpoint nfty używany przez worker po udanym refreshu z nowymi ofertami
- `NFTY_LOGIN`: login do Basic Auth dla nfty
- `NFTY_PASSWORD`: hasło do Basic Auth dla nfty
- `NFTY_CLICK_URL`: opcjonalny URL otwierany po kliknięciu notyfikacji
```

```md
Jeżeli worker zakończy refresh z `stats_added > 0` i konfiguracja nfty jest kompletna, wyśle jedną notyfikację nfty dla całego runu. Błąd wysyłki notyfikacji nie oznacza błędu importu.
```

- [ ] **Step 4: Run targeted docs tests to verify they pass**

Run: `npm test -- tests/docs/readme-smoke.test.ts`

Expected: PASS

- [ ] **Step 5: Run full verification**

Run: `npm test -- tests/config/env.test.ts tests/app/runtime.test.ts tests/worker/run-worker.test.ts tests/docs/readme-smoke.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add .env.example README.md tests/docs/readme-smoke.test.ts tests/config/env.test.ts tests/app/runtime.test.ts tests/worker/run-worker.test.ts src/config/env.ts src/app/runtime.ts src/worker/run-worker.ts
git commit -m "docs: document nfty worker notifications"
```

## Self-Review

- Spec coverage: plan covers optional env config, one-per-run notification semantics, Basic Auth, click-through URL, worker integration point, failure isolation, and docs/tests.
- Placeholder scan: no `TODO`, `TBD`, or “similar to previous task” references remain.
- Type consistency: `publishNftyNotification` is introduced in runtime and consumed as `publishNotification` by the worker, with `added: number` as the only argument throughout.
