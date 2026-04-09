import { describe, expect, it } from "vitest";
import { buildServer } from "../../src/web/server.js";

describe("buildServer", () => {
  it("returns a Fastify instance with health route", async () => {
    const app = buildServer();
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it("serves the client bundle for the offers table", async () => {
    const app = buildServer({
      timezone: "Europe/Warsaw",
      listOffers: async () => [],
      updateOffer: async () => ({ ok: true }),
      createOrReuseRefreshJob: async () => ({ ok: true }),
      getLatestSuccessfulRefresh: async () => null
    });
    const response = await app.inject({ method: "GET", url: "/assets/offers-app.js" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/javascript");
    expect(response.body).toContain("createRoot");
    expect(response.body).not.toContain("react.development.js");
    expect(response.body.length).toBeLessThan(500_000);
  });
});
