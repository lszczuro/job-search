import { describe, expect, it } from "vitest";
import { runImport } from "../../src/core/importing/run-import";

describe("runImport", () => {
  it("counts fetched, added, rejected, and duplicate offers", async () => {
    const insertedUrls = new Set<string>(["https://example.com/existing"]);

    const result = await runImport({
      offers: [
        {
          title: "Senior AI Engineer",
          description: "Node.js TypeScript OpenAI",
          location: "Remote",
          workMode: "Remote",
          company: "Acme",
          url: "https://example.com/1",
          contract: "B2B",
          technologies: ["Node.js", "TypeScript", "OpenAI"]
        },
        {
          title: "Frontend Engineer",
          description: "React only",
          location: "Katowice",
          workMode: "Remote",
          company: "Acme",
          url: "https://example.com/2",
          contract: "B2B",
          technologies: ["React"]
        },
        {
          title: "Senior AI Engineer",
          description: "Node.js TypeScript OpenAI",
          location: "Remote",
          workMode: "Remote",
          company: "Acme",
          url: "https://example.com/existing",
          contract: "B2B",
          technologies: ["Node.js", "TypeScript", "OpenAI"]
        }
      ],
      profile: {
        knownStack: ["nodejs", "typescript", "openai"],
        profileKeywords: ["ai engineer"],
        allowedCities: ["Katowice"]
      },
      hasUrl: async (url) => insertedUrls.has(url),
      saveOffer: async (offer) => {
        insertedUrls.add(offer.url);
      }
    });

    expect(result).toEqual({
      fetched: 3,
      added: 1,
      rejected: 1,
      duplicates: 1,
      errors: 0
    });
  });
});
