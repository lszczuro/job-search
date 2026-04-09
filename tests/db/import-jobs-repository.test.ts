import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { createImportJobsRepository } from "../../src/db/repositories/import-jobs-repository";

describe("createImportJobsRepository", () => {
  let sqlite: Database.Database | null = null;

  afterEach(() => {
    sqlite?.close();
    sqlite = null;
  });

  it("reuses an active refresh job before creating a duplicate", async () => {
    sqlite = new Database(":memory:");
    sqlite.exec(`
      CREATE TABLE import_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        requested_by TEXT NOT NULL,
        payload TEXT NOT NULL,
        stats_fetched INTEGER NOT NULL DEFAULT 0,
        stats_added INTEGER NOT NULL DEFAULT 0,
        stats_rejected INTEGER NOT NULL DEFAULT 0,
        stats_duplicates INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT
      )
    `);

    sqlite
      .prepare(
        `INSERT INTO import_jobs (kind, status, requested_by, payload, created_at) VALUES (?, ?, ?, ?, ?)`
      )
      .run("scheduled_refresh", "running", "system", "{}", "2026-04-09T10:00:00.000Z");

    const repository = createImportJobsRepository(sqlite);
    const job = await repository.createOrReuseRefreshJob("manual_refresh", "user");

    expect(job.id).toBe(1);
    expect(job.kind).toBe("scheduled_refresh");
    expect(job.status).toBe("running");
    expect(job.reused).toBe(true);
  });

  it("creates a pending refresh job when none is active", async () => {
    sqlite = new Database(":memory:");
    sqlite.exec(`
      CREATE TABLE import_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        requested_by TEXT NOT NULL,
        payload TEXT NOT NULL,
        stats_fetched INTEGER NOT NULL DEFAULT 0,
        stats_added INTEGER NOT NULL DEFAULT 0,
        stats_rejected INTEGER NOT NULL DEFAULT 0,
        stats_duplicates INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT
      )
    `);

    const repository = createImportJobsRepository(sqlite);
    const job = await repository.createOrReuseRefreshJob("manual_refresh", "user");

    expect(job.id).toBe(1);
    expect(job.kind).toBe("manual_refresh");
    expect(job.status).toBe("pending");
    expect(job.reused).toBe(false);
  });
});
