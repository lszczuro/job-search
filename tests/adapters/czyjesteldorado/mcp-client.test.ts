import { describe, expect, it } from "vitest";
import { mapMcpJobOffer } from "../../../src/adapters/czyjesteldorado/mcp-client";

describe("mapMcpJobOffer", () => {
  it("maps MCP offer payload into internal imported offer shape", () => {
    const offer = mapMcpJobOffer({
      title: "AI / LLM Engineer",
      keywords: ["Python", "LLM", "OpenAI"],
      company: "Acme",
      cities: ["Gliwice"],
      work_modes: ["remote"],
      contract_types: ["employment_contract", "b2b"],
      employment_types: ["full_time"],
      seniority: "mid",
      salary_from: 15000,
      salary_to: 18000,
      url: "https://czyjesteldorado.pl/praca/123-test"
    });

    expect(offer).toMatchObject({
      title: "AI / LLM Engineer",
      description: "Python LLM OpenAI",
      location: "Gliwice",
      workMode: "Remote",
      company: "Acme",
      contract: "Oba",
      technologies: ["Python", "LLM", "OpenAI"],
      salaryFrom: 15000,
      salaryTo: 18000
    });
  });
});
