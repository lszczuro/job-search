import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("README", () => {
  it("documents web, worker, and migration commands", () => {
    const readme = readFileSync("README.md", "utf8");

    expect(readme).toContain("npm run web");
    expect(readme).toContain("npm run worker");
    expect(readme).toContain("npm run db:migrate");
  });
});
