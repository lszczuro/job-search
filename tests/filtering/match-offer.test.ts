import { describe, expect, it } from "vitest";
import { evaluateOffer } from "../../src/core/filtering/match-offer";

const profile = {
  knownStack: ["nodejs", "typescript", "openai"],
  profileKeywords: ["ai engineer", "llm engineer"],
  allowedCities: ["Gliwice", "Katowice", "Chorzow", "Ruda Slaska", "Zabrze", "Sosnowiec", "Bytom", "Siemianowice Slaskie"]
};

describe("evaluateOffer", () => {
  it("accepts remote offer when title matches profile", () => {
    const result = evaluateOffer(
      {
        title: "Senior AI Engineer",
        description: "Node.js TypeScript OpenAI",
        location: "Warszawa",
        workMode: "Remote",
        company: "Acme",
        url: "https://example.com/1",
        contract: "B2B",
        technologies: ["Node.js", "TypeScript", "OpenAI"]
      },
      profile
    );

    expect(result.accepted).toBe(true);
    expect(result.priority).toBe("🔥 Teraz");
    expect(result.generatedNotes).toEqual([]);
  });

  it("rejects hybrid offer outside allowed geography", () => {
    const result = evaluateOffer(
      {
        title: "LLM Engineer",
        description: "TypeScript and Python",
        location: "Warszawa",
        workMode: "Hybrid",
        company: "Acme",
        url: "https://example.com/2",
        contract: "B2B",
        technologies: ["TypeScript", "Python"]
      },
      profile
    );

    expect(result.accepted).toBe(false);
    expect(result.rejectionReason).toBe("location");
  });
});
