import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("README", () => {
  it("documents web, worker, timezone, migration commands, and CI container publishing", () => {
    const readme = readFileSync("README.md", "utf8");

    expect(readme).toContain("npm run web");
    expect(readme).toContain("npm run worker");
    expect(readme).toContain("npm run db:migrate");
    expect(readme).toContain("APP_TIMEZONE=Europe/Warsaw");
    expect(readme).toContain("worker wykonuje pending refresh jobs");
    expect(readme).toContain("ghcr.io");
    expect(readme).toContain("latest");
    expect(readme).toContain("vX.Y.Z");
  });
});
