import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { buildServer } from "../../src/web/server";

describe("offer routes", () => {
  const createdDirs: string[] = [];

  afterEach(() => {
    delete process.env.DATABASE_PATH;
    for (const dir of createdDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

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

  it("persists patched fields in sqlite and returns them on the next load", async () => {
    const dir = mkdtempSync(join(tmpdir(), "job-search-offers-"));
    const databasePath = join(dir, "offers.db");
    createdDirs.push(dir);
    process.env.DATABASE_PATH = databasePath;

    const app = buildServer();
    const sqlite = new Database(databasePath);

    sqlite
      .prepare(
        `
          INSERT INTO job_offers (
            stanowisko, firma, url, widełki_od, widełki_do, lokalizacja, tryb_pracy,
            kontrakt, status_ogloszenia, status_aplikacji, priorytet, notatki,
            data_dodania, ostatnia_weryfikacja, source, source_external_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(
        "AI Engineer",
        "Acme",
        "https://example.com/1",
        20000,
        28000,
        "Remote",
        "Remote",
        "B2B",
        "🟢 Aktywne",
        "📋 Zapisana",
        "🔥 Teraz",
        "Python,AI",
        "2026-04-09",
        null,
        "manual",
        null,
        "2026-04-09T08:00:00.000Z",
        "2026-04-09T08:00:00.000Z"
      );

    const patchResponse = await app.inject({
      method: "PATCH",
      url: "/offers/1",
      payload: { status_aplikacji: "CV wysłane", notatki: "Python,AI,Follow-up" }
    });
    const listResponse = await app.inject({ method: "GET", url: "/offers" });

    sqlite.close();

    expect(patchResponse.statusCode).toBe(200);
    expect(patchResponse.json()).toEqual({ ok: true });
    expect(listResponse.json()).toEqual([
      expect.objectContaining({
        id: 1,
        statusAplikacji: "CV wysłane",
        notatki: "Python,AI,Follow-up"
      })
    ]);
  });
});
