import { describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
import { jobOffers, importJobs } from "../../src/db/schema";

describe("schema", () => {
  it("defines expected sqlite tables", () => {
    expect(getTableName(jobOffers)).toBe("job_offers");
    expect(getTableName(importJobs)).toBe("import_jobs");
  });
});
