import { describe, expect, it } from "vitest";
import { parseEnv } from "../../src/config/env";

describe("parseEnv", () => {
  it("parses refresh interval and known stack", () => {
    const config = parseEnv({
      PORT: "3010",
      REFRESH_CRON: "0 7 * * *",
      KNOWN_STACK: "nodejs,typescript,openai",
      PROFILE_KEYWORDS: "ai engineer,llm engineer",
      ALLOWED_CITIES: "Gliwice,Katowice"
    });

    expect(config.port).toBe(3010);
    expect(config.refreshCron).toBe("0 7 * * *");
    expect(config.knownStack).toEqual(["nodejs", "typescript", "openai"]);
    expect(config.allowedCities).toEqual(["Gliwice", "Katowice"]);
  });

  it("uses a 30-minute cron and explicit timezone by default", () => {
    const config = parseEnv({});

    expect(config.refreshCron).toBe("*/30 * * * *");
    expect(config.timezone).toBe("Europe/Warsaw");
  });
});
