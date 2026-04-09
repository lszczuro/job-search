import { describe, expect, it } from "vitest";
import { executeNextJob } from "../../src/worker/run-worker";

describe("executeNextJob", () => {
  it("runs one pending import job and marks it succeeded", async () => {
    const state = {
      nextJob: { id: 1, kind: "manual_refresh", status: "pending" },
      updates: [] as string[]
    };

    await executeNextJob({
      fetchPendingJob: async () => state.nextJob,
      markRunning: async (id) => {
        state.updates.push(`running:${id}`);
      },
      runJob: async () => ({
        fetched: 2,
        added: 1,
        rejected: 1,
        duplicates: 0,
        errors: 0
      }),
      markSucceeded: async (id, result) => {
        state.updates.push(`done:${id}:${result.added}`);
      }
    });

    expect(state.updates).toEqual(["running:1", "done:1:1"]);
  });
});
