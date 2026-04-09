import { describe, expect, it } from "vitest";
import { renderOffersList } from "../../src/web/routes/offers-routes";

describe("renderOffersList", () => {
  it("renders a React app shell with serialized offers and client bundle", () => {
    const html = renderOffersList([
      {
        id: 1,
        stanowisko: "AI Engineer",
        firma: "Acme",
        priorytet: "🔥 Teraz",
        url: "https://example.com/offers/1",
        lokalizacja: "Katowice",
        trybPracy: "Remote",
        kontrakt: "B2B",
        statusOgloszenia: "🟢 Aktywne",
        statusAplikacji: "📋 Zapisana",
        notatki: "postgres,aws"
      }
    ]);

    expect(html).toContain('id="offers-app"');
    expect(html).toContain("/assets/offers-app.js");
    expect(html).toContain('"url":"https://example.com/offers/1"');
    expect(html).toContain('"statusAplikacji":"📋 Zapisana"');
  });

  it("renders a visible empty state when there are no offers", () => {
    const html = renderOffersList([]);

    expect(html).toContain("Job Tracker");
    expect(html).toContain('id="offers-app"');
    expect(html).toContain("/assets/offers-app.js");
  });
});
