import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("GitHub Actions publish workflow", () => {
  it("publishes latest from main and semver tags from git tags", () => {
    const workflow = readFileSync(".github/workflows/publish.yml", "utf8");

    expect(workflow).toContain("branches:");
    expect(workflow).toContain("- main");
    expect(workflow).toContain("tags:");
    expect(workflow).toContain("- 'v*.*.*'");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("packages: write");
    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("npm test");
    expect(workflow).toContain("npm run build");
    expect(workflow).toContain("ghcr.io");
    expect(workflow).toContain("type=raw,value=latest,enable={{is_default_branch}}");
    expect(workflow).toContain("type=match,pattern=v(.*),group=1");
  });
});
