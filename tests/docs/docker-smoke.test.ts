import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Docker artifacts", () => {
  it("ignore host node_modules in docker build context", () => {
    const dockerignore = readFileSync(".dockerignore", "utf8");

    expect(dockerignore).toContain("node_modules");
  });

  it("pass application env file to compose services", () => {
    const compose = readFileSync("docker-compose.yml", "utf8");

    expect(compose).toContain("env_file:");
    expect(compose).toContain("- .env");
  });
});
