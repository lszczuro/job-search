import { describe, expect, it } from "vitest";
import { getOfferLabels, serializeOffersForHtml } from "../../src/web/offer-view-model";

describe("offer view model", () => {
  it("builds labels from priority, statuses, and notes", () => {
    const labels = getOfferLabels({
      id: 1,
      stanowisko: "AI Engineer",
      firma: "Acme",
      priorytet: "🔥 Teraz",
      statusAplikacji: "📋 Zapisana",
      statusOgloszenia: "🟢 Aktywne",
      notatki: "postgres, aws "
    });

    expect(labels).toEqual([
      "🔥 Teraz",
      "📋 Zapisana",
      "🟢 Aktywne",
      "postgres",
      "aws"
    ]);
  });

  it("escapes html-sensitive characters in serialized offers", () => {
    const payload = serializeOffersForHtml([
      {
        id: 1,
        stanowisko: "<script>alert(1)</script>",
        firma: "Acme"
      }
    ]);

    expect(payload).not.toContain("<script>");
    expect(payload).toContain("\\u003cscript>");
  });
});
