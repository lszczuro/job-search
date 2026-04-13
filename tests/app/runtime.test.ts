import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRuntimeDeps } from "../../src/app/runtime";

describe("publishNftyNotification", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

describe("manual offer entry", () => {
  const createdDirs: string[] = [];

  afterEach(() => {
    for (const dir of createdDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("persists a manual offer with the agreed defaults and exposes it through listOffers()", async () => {
    const dir = mkdtempSync(join(tmpdir(), "job-search-offers-runtime-"));
    const databasePath = join(dir, "offers.db");
    createdDirs.push(dir);

    const runtime = createRuntimeDeps({ DATABASE_PATH: databasePath }) as any;

    await runtime.createOffer({
      stanowisko: "AI Engineer",
      firma: "Acme",
      url: "https://example.com/manual"
    });

    const offers = await runtime.listOffers();
    const sqlite = new Database(databasePath);
    const row = sqlite
      .prepare(
        `
          SELECT
            stanowisko,
            firma,
            url,
            lokalizacja,
            tryb_pracy AS trybPracy,
            kontrakt,
            status_ogloszenia AS statusOgloszenia,
            status_aplikacji AS statusAplikacji,
            priorytet,
            notatki,
            data_dodania AS dataDodania,
            source,
            source_external_id AS sourceExternalId,
            created_at AS createdAt,
            updated_at AS updatedAt
          FROM job_offers
          WHERE url = ?
        `
      )
      .get("https://example.com/manual") as
      | {
          stanowisko: string;
          firma: string;
          url: string;
          lokalizacja: string;
          trybPracy: string;
          kontrakt: string;
          statusOgloszenia: string;
          statusAplikacji: string;
          priorytet: string;
          notatki: string;
          dataDodania: string;
          source: string;
          sourceExternalId: string | null;
          createdAt: string;
          updatedAt: string;
        }
      | undefined;

    sqlite.close();

    expect(offers).toEqual([
      expect.objectContaining({
        stanowisko: "AI Engineer",
        firma: "Acme",
        url: "https://example.com/manual",
        lokalizacja: "Brak danych",
        trybPracy: "Nieznany",
        kontrakt: "Nieznany",
        statusOgloszenia: "🟢 Aktywne",
        statusAplikacji: "📋 Zapisana",
        priorytet: "🔥 Teraz",
        notatki: "",
        ostatniaWeryfikacja: null
      })
    ]);
    expect(row).toEqual(
      expect.objectContaining({
        stanowisko: "AI Engineer",
        firma: "Acme",
        url: "https://example.com/manual",
        lokalizacja: "Brak danych",
        trybPracy: "Nieznany",
        kontrakt: "Nieznany",
        statusOgloszenia: "🟢 Aktywne",
        statusAplikacji: "📋 Zapisana",
        priorytet: "🔥 Teraz",
        notatki: "",
        source: "manual",
        sourceExternalId: null
      })
    );
    expect(row?.dataDodania).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(row?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(row?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(row?.createdAt).toBe(row?.updatedAt);
  });
});
