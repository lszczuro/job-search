import { describe, expect, it } from "vitest";
import { buildServer } from "../../src/web/server";

describe("offer routes", () => {
  it("returns offer list payload", async () => {
    const app = buildServer({
      listOffers: async () => [{ id: 1, stanowisko: "AI Engineer", firma: "Acme" }]
    });

    const response = await app.inject({ method: "GET", url: "/offers" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([{ id: 1, stanowisko: "AI Engineer", firma: "Acme" }]);
  });

  it("updates editable fields inline", async () => {
    const changes: Array<{ id: number; priorytet: string }> = [];
    const app = buildServer({
      listOffers: async () => [],
      updateOffer: async (id, payload) => {
        changes.push({ id, priorytet: payload.priorytet });
        return { ok: true };
      }
    });

    const response = await app.inject({
      method: "PATCH",
      url: "/offers/7",
      payload: { priorytet: "👀 Obserwuj" }
    });

    expect(response.statusCode).toBe(200);
    expect(changes).toEqual([{ id: 7, priorytet: "👀 Obserwuj" }]);
  });
});
