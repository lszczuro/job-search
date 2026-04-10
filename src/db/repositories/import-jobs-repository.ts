import type Database from "better-sqlite3";

export type ImportJobRecord = {
  id: number;
  kind: string;
  status: string;
  requestedBy: string;
  payload: string;
  statsFetched: number;
  statsAdded: number;
  statsRejected: number;
  statsDuplicates: number;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  reused?: boolean;
};

type RefreshJobKind = "manual_refresh" | "scheduled_refresh";
type JobResult = {
  fetched: number;
  added: number;
  rejected: number;
  duplicates: number;
  errors: number;
};

type CreateRefreshJobOptions = {
  now?: string;
};

const RUNNING_REFRESH_JOB_TIMEOUT_MS = 30 * 60 * 1_000;
const INTERRUPTED_REFRESH_ERROR = "Worker interrupted before refresh job completed";

function mapRow(row: Record<string, unknown>): ImportJobRecord {
  return {
    id: Number(row.id),
    kind: String(row.kind),
    status: String(row.status),
    requestedBy: String(row.requested_by),
    payload: String(row.payload),
    statsFetched: Number(row.stats_fetched),
    statsAdded: Number(row.stats_added),
    statsRejected: Number(row.stats_rejected),
    statsDuplicates: Number(row.stats_duplicates),
    errorMessage: row.error_message == null ? null : String(row.error_message),
    createdAt: String(row.created_at),
    startedAt: row.started_at == null ? null : String(row.started_at),
    finishedAt: row.finished_at == null ? null : String(row.finished_at)
  };
}

export function createImportJobsRepository(sqlite: Database.Database) {
  function getNow(options?: CreateRefreshJobOptions) {
    return options?.now ?? new Date().toISOString();
  }

  function isStaleRunningRefreshJob(job: ImportJobRecord, now: string) {
    if (job.status !== "running") {
      return false;
    }

    if (!job.startedAt) {
      return true;
    }

    return Date.parse(job.startedAt) <= Date.parse(now) - RUNNING_REFRESH_JOB_TIMEOUT_MS;
  }

  function markRefreshJobInterrupted(id: number, now: string) {
    sqlite
      .prepare(
        `
          UPDATE import_jobs
          SET status = 'failed',
              error_message = ?,
              finished_at = ?
          WHERE id = ?
        `
      )
      .run(INTERRUPTED_REFRESH_ERROR, now, id);
  }

  return {
    async findActiveRefreshJob() {
      const row = sqlite
        .prepare(
          `
            SELECT *
            FROM import_jobs
            WHERE kind IN ('manual_refresh', 'scheduled_refresh')
              AND status IN ('pending', 'running')
            ORDER BY id DESC
            LIMIT 1
          `
        )
        .get() as Record<string, unknown> | undefined;

      return row ? mapRow(row) : null;
    },
    async createOrReuseRefreshJob(kind: RefreshJobKind, requestedBy: string, options?: CreateRefreshJobOptions) {
      const existing = await this.findActiveRefreshJob();
      const now = getNow(options);

      if (existing) {
        if (isStaleRunningRefreshJob(existing, now)) {
          markRefreshJobInterrupted(existing.id, now);
        } else {
          return { ...existing, reused: true };
        }
      }

      const createdAt = now;
      const inserted = sqlite
        .prepare(
          `
            INSERT INTO import_jobs (
              kind, status, requested_by, payload, created_at
            ) VALUES (?, 'pending', ?, '{}', ?)
          `
        )
        .run(kind, requestedBy, createdAt);

      return {
        id: Number(inserted.lastInsertRowid),
        kind,
        status: "pending",
        requestedBy,
        payload: "{}",
        statsFetched: 0,
        statsAdded: 0,
        statsRejected: 0,
        statsDuplicates: 0,
        errorMessage: null,
        createdAt,
        startedAt: null,
        finishedAt: null,
        reused: false
      } satisfies ImportJobRecord;
    },
    async getLatestSuccessfulRefresh() {
      const row = sqlite
        .prepare(
          `
            SELECT finished_at
            FROM import_jobs
            WHERE kind IN ('manual_refresh', 'scheduled_refresh')
              AND status = 'succeeded'
              AND finished_at IS NOT NULL
            ORDER BY datetime(finished_at) DESC
            LIMIT 1
          `
        )
        .get() as { finished_at: string } | undefined;

      return row?.finished_at ?? null;
    },
    async fetchPendingJob() {
      const row = sqlite
        .prepare(
          `
            SELECT *
            FROM import_jobs
            WHERE kind IN ('manual_refresh', 'scheduled_refresh')
              AND status = 'pending'
            ORDER BY id ASC
            LIMIT 1
          `
        )
        .get() as Record<string, unknown> | undefined;

      return row ? mapRow(row) : null;
    },
    async markJobRunning(id: number) {
      sqlite
        .prepare(
          `
            UPDATE import_jobs
            SET status = 'running',
                started_at = ?
            WHERE id = ?
          `
        )
        .run(new Date().toISOString(), id);
    },
    async markJobSucceeded(id: number, result: JobResult) {
      sqlite
        .prepare(
          `
            UPDATE import_jobs
            SET status = 'succeeded',
                stats_fetched = ?,
                stats_added = ?,
                stats_rejected = ?,
                stats_duplicates = ?,
                finished_at = ?,
                error_message = NULL
            WHERE id = ?
          `
        )
        .run(
          result.fetched,
          result.added,
          result.rejected,
          result.duplicates,
          new Date().toISOString(),
          id
        );
    },
    async markJobFailed(id: number, errorMessage: string) {
      sqlite
        .prepare(
          `
            UPDATE import_jobs
            SET status = 'failed',
                error_message = ?,
                finished_at = ?
            WHERE id = ?
          `
        )
        .run(errorMessage, new Date().toISOString(), id);
    }
  };
}
