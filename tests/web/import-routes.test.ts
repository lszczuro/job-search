import { describe, expect, it } from "vitest";
import { buildServer } from "../../src/web/server";

describe("import routes", () => {
  it("creates manual refresh job", async () => {
    const created: string[] = [];
    const app = buildServer({
      createImportJob: async (kind) => {
        created.push(kind);
        return { id: 11, kind };
      }
    });

    const response = await app.inject({ method: "POST", url: "/imports/refresh" });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ id: 11, kind: "manual_refresh" });
    expect(created).toEqual(["manual_refresh"]);
  });
});
