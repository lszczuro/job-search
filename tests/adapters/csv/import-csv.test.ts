import { describe, expect, it } from "vitest";
import { mapCsvRow } from "../../../src/adapters/csv/import-csv";

describe("mapCsvRow", () => {
  it("maps notion-export headers into internal offer format", () => {
    const offer = mapCsvRow({
      Stanowisko: "Senior AI Engineer",
      "Status aplikacji": "📋 Zapisana",
      "Data dodania": "2026-04-09",
      Firma: "Acme",
      URL: "https://example.com/1",
      Kontrakt: "B2B",
      Lokalizacja: "Katowice",
      Notatki: "Python",
      "Widełki od": "25000",
      "Widełki do": "30000",
      "Ostatnia weryfikacja": "",
      Priorytet: "🔥 Teraz",
      "Status ogłoszenia": "🟢 Aktywne",
      "Tryb pracy": "Remote"
    });

    expect(offer.url).toBe("https://example.com/1");
    expect(offer.workMode).toBe("Remote");
    expect(offer.company).toBe("Acme");
  });
});
