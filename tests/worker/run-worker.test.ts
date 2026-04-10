import { describe, expect, it } from "vitest";
import { executeNextJob, scheduleRefreshCron } from "../../src/worker/run-worker";

describe("executeNextJob", () => {
  it("runs one pending import job and marks it succeeded", async () => {
    const state = {
      nextJob: { id: 1, kind: "manual_refresh", status: "pending" },
      updates: [] as string[]
    };

    const didRun = await executeNextJob({
      fetchPendingJob: async () => state.nextJob,
      markRunning: async (id) => {
        state.updates.push(`running:${id}`);
      },
      runRefreshJob: async (id) => {
        state.updates.push(`execute:${id}`);
        return {
          fetched: 2,
          added: 1,
          rejected: 1,
          duplicates: 0,
          errors: 0
        };
      },
      publishNotification: async (added) => {
        state.updates.push(`notify:${added}`);
      },
      markSucceeded: async (id, result) => {
        state.updates.push(`done:${id}:${result.added}`);
      },
      markFailed: async (id, errorMessage) => {
        state.updates.push(`failed:${id}:${errorMessage}`);
      }
    });

    expect(didRun).toBe(true);
    expect(state.updates).toEqual(["running:1", "execute:1", "notify:1", "done:1:1"]);
  });

  it("marks the job failed when refresh execution throws", async () => {
    const state = {
      nextJob: { id: 6, kind: "scheduled_refresh", status: "pending" },
      updates: [] as string[]
    };

    const didRun = await executeNextJob({
      fetchPendingJob: async () => state.nextJob,
      markRunning: async (id) => {
        state.updates.push(`running:${id}`);
      },
      runRefreshJob: async () => {
        throw new Error("mcp unavailable");
      },
      publishNotification: async (added) => {
        state.updates.push(`notify:${added}`);
      },
      markSucceeded: async (id, result) => {
        state.updates.push(`done:${id}:${result.added}`);
      },
      markFailed: async (id, errorMessage) => {
        state.updates.push(`failed:${id}:${errorMessage}`);
      }
    });

    expect(didRun).toBe(true);
    expect(state.updates).toEqual(["running:6", "failed:6:mcp unavailable"]);
  });

  it("skips notification when a refresh adds no new offers", async () => {
    const state = {
      nextJob: { id: 3, kind: "manual_refresh", status: "pending" },
      updates: [] as string[]
    };

    const didRun = await executeNextJob({
      fetchPendingJob: async () => state.nextJob,
      markRunning: async (id) => {
        state.updates.push(`running:${id}`);
      },
      runRefreshJob: async () => ({
        fetched: 2,
        added: 0,
        rejected: 1,
        duplicates: 1,
        errors: 0
      }),
      publishNotification: async (added) => {
        state.updates.push(`notify:${added}`);
      },
      markSucceeded: async (id, result) => {
        state.updates.push(`done:${id}:${result.added}`);
      },
      markFailed: async (id, errorMessage) => {
        state.updates.push(`failed:${id}:${errorMessage}`);
      }
    });

    expect(didRun).toBe(true);
    expect(state.updates).toEqual(["running:3", "done:3:0"]);
  });

  it("still marks the job succeeded when nfty delivery fails", async () => {
    const state = {
      nextJob: { id: 2, kind: "manual_refresh", status: "pending" },
      updates: [] as string[]
    };

    const didRun = await executeNextJob({
      fetchPendingJob: async () => state.nextJob,
      markRunning: async (id) => {
        state.updates.push(`running:${id}`);
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
        state.updates.push(`done:${id}:${result.added}`);
      },
      markFailed: async (id, errorMessage) => {
        state.updates.push(`failed:${id}:${errorMessage}`);
      }
    });

    expect(didRun).toBe(true);
    expect(state.updates).toEqual(["running:2", "done:2:1"]);
  });
});

describe("scheduleRefreshCron", () => {
  it("creates a scheduled refresh job on cron tick", async () => {
    const created: string[] = [];
    const scheduler = scheduleRefreshCron({
      cron: "*/30 * * * *",
      timezone: "Europe/Warsaw",
      enqueueScheduledRefresh: async () => {
        created.push("scheduled_refresh");
      }
    });

    await scheduler.tick();

    expect(created).toEqual(["scheduled_refresh"]);
  });

  it("can skip scheduling when an active refresh already exists", async () => {
    const created: string[] = [];
    const scheduler = scheduleRefreshCron({
      cron: "*/30 * * * *",
      timezone: "Europe/Warsaw",
      enqueueScheduledRefresh: async () => {
        if (created.length > 0) {
          return;
        }

        created.push("scheduled_refresh");
      }
    });

    await scheduler.tick();
    await scheduler.tick();

    expect(created).toEqual(["scheduled_refresh"]);
  });
});
