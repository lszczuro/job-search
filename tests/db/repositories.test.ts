import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryRepositories } from "../../src/db/repositories/offers-repository";

describe("repositories", () => {
  const repos = createInMemoryRepositories();

  beforeEach(() => repos.reset());

  it("skips inserting duplicate offers by url", async () => {
    await repos.offers.insert({
      stanowisko: "AI Engineer",
      firma: "Acme",
      url: "https://example.com/1",
      lokalizacja: "Gliwice",
      trybPracy: "Remote",
      kontrakt: "B2B",
      statusOgloszenia: "🟢 Aktywne",
      statusAplikacji: "📋 Zapisana",
      priorytet: "🔥 Teraz",
      notatki: "",
      dataDodania: "2026-04-09",
      source: "czyjesteldorado"
    });

    const inserted = await repos.offers.insert({
      stanowisko: "AI Engineer",
      firma: "Acme",
      url: "https://example.com/1",
      lokalizacja: "Gliwice",
      trybPracy: "Remote",
      kontrakt: "B2B",
      statusOgloszenia: "🟢 Aktywne",
      statusAplikacji: "📋 Zapisana",
      priorytet: "🔥 Teraz",
      notatki: "",
      dataDodania: "2026-04-09",
      source: "czyjesteldorado"
    });

    expect(inserted).toBe(false);
    expect(await repos.offers.count()).toBe(1);
  });
});
