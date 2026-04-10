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

  it("parses optional nfty configuration", () => {
    const config = parseEnv({
      NFTY_ENDPOINT: "https://nfty.sh/job-search",
      NFTY_LOGIN: "alice",
      NFTY_PASSWORD: "secret",
      NFTY_CLICK_URL: "https://job-search.local/offers"
    });

    expect(config.nfty).toEqual({
      endpoint: "https://nfty.sh/job-search",
      login: "alice",
      password: "secret",
      clickUrl: "https://job-search.local/offers"
    });
  });
});
