import { describe, expect, it } from "vitest";
import { buildServer } from "../../src/web/server";

describe("import routes", () => {
  it("creates or reuses a manual refresh job", async () => {
    const created: string[] = [];
    const app = buildServer({
      createOrReuseRefreshJob: async (kind) => {
        created.push(kind);
        return { id: 11, kind, status: "pending", reused: false };
      }
    });

    const response = await app.inject({ method: "POST", url: "/imports/refresh" });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({
      id: 11,
      kind: "manual_refresh",
      status: "pending",
      reused: false
    });
    expect(created).toEqual(["manual_refresh"]);
  });
});
