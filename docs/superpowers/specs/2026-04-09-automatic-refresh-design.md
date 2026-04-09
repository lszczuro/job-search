# Automatic Refresh Design

## Goal

Move refresh execution out of the synchronous `web` request path and into the background worker, while activating cron-based scheduling and surfacing refresh status in the GUI.

## Scope

This design covers:

- manual refresh enqueueing through `POST /imports/refresh`
- background execution of refresh jobs in the worker
- cron-triggered refresh scheduling from `REFRESH_CRON`
- persistence of refresh lifecycle and import statistics in `import_jobs`
- timezone-aware scheduling and timestamp display
- a GUI refresh button and "last updated" indicator

This design does not add retry semantics, distributed locking, or stale-job recovery beyond the current single-process-per-role model.

## Current State

- `POST /imports/refresh` creates an `import_jobs` row and immediately performs the full MCP import in the `web` process
- `REFRESH_CRON` is parsed from env but does not drive an active scheduler
- `src/worker/run-worker.ts` contains only a thin execution helper and is not wired to the real import pipeline
- the GUI does not show the last refresh time and does not expose a manual refresh control

## Design Summary

The system will keep two runtime processes:

- `web` accepts HTTP traffic and persists refresh requests
- `worker` owns refresh scheduling and refresh execution

Both manual and scheduled refreshes will use one shared job lifecycle:

1. Create or reuse a refresh job in `import_jobs`
2. Worker claims the next pending refresh job
3. Worker executes the existing MCP import pipeline
4. Worker writes success or failure status plus import statistics

The worker will also run a cron scheduler using `REFRESH_CRON`. The default cron expression becomes every 30 minutes.

## Architecture

### Web responsibility

`web` will:

- expose `POST /imports/refresh`
- create or reuse one active refresh job
- return `202 Accepted` with the queued or in-flight job metadata
- expose enough page data for the GUI to render the latest successful refresh timestamp

`web` will not:

- call the MCP endpoint for refresh
- run `runImport` inline
- mark jobs `running`, `succeeded`, or `failed`

### Worker responsibility

`worker` will:

- start a polling loop for pending jobs
- start a cron scheduler based on `REFRESH_CRON`
- create scheduled refresh jobs on cron ticks
- claim pending jobs atomically
- execute the real refresh import pipeline
- persist lifecycle timestamps, stats, and error state

### Shared refresh execution

The current inline import logic in `src/app/runtime.ts` will be extracted into a shared refresh executor that:

- fetches offers via `searchJobsViaMcp`
- calls `runImport`
- saves accepted offers into SQLite
- returns aggregate stats for `import_jobs`

This executor will be called only by the worker for refresh jobs.

## Job Model

### Job kinds

Refresh behavior uses:

- `manual_refresh`
- `scheduled_refresh`

### Job states

Refresh jobs move through:

- `pending`
- `running`
- `succeeded`
- `failed`

### De-duplication rule

Only one refresh job may be active at a time across both refresh kinds.

If a refresh request arrives while any refresh job is `pending` or `running`:

- manual trigger returns the existing active refresh job
- cron trigger does not create a duplicate row

This keeps refresh semantics aligned with "bring local state up to date" rather than "record every trigger as distinct work".

## Data Flow

### Manual refresh flow

1. User clicks the GUI refresh button or calls `POST /imports/refresh`
2. `web` checks for any refresh job with status `pending` or `running`
3. If one exists, `web` returns that job with `202`
4. Otherwise `web` inserts a new `manual_refresh` job with status `pending`
5. Worker polling loop claims the next pending job and sets it to `running`
6. Worker records `started_at`
7. Worker runs the refresh executor
8. Worker updates `stats_fetched`, `stats_added`, `stats_rejected`, `stats_duplicates`, optional `error_message`, `finished_at`, and final `status`

### Scheduled refresh flow

1. Worker starts cron using `REFRESH_CRON`
2. On each tick, worker checks for any refresh job with status `pending` or `running`
3. If one exists, the tick is skipped
4. Otherwise worker inserts a new `scheduled_refresh` job with status `pending`
5. The normal worker execution loop picks up that job and runs the same refresh executor used for manual refresh

## Timezone Handling

### Configuration

Introduce an explicit timezone configuration value, for example `APP_TIMEZONE`.

Default:

- `REFRESH_CRON`: `*/30 * * * *`
- `APP_TIMEZONE`: `Europe/Warsaw`

### Rules

- cron evaluation must run in the configured timezone
- GUI timestamps must be formatted in the configured timezone
- persisted timestamps in SQLite remain ISO timestamps so storage stays stable and comparable

This keeps storage normalized while making scheduling and display match the user's local expectation.

## GUI Changes

The main offers page will show:

- a manual refresh button
- the last successful refresh timestamp

### Button behavior

- sends `POST /imports/refresh`
- does not wait for the import to finish before returning
- can display a simple queued/in-progress confirmation based on the response

### Last updated indicator

The page will derive this value from the newest successful refresh job:

- prefer `finished_at`
- show an empty or fallback state when no successful refresh exists yet

This indicator reflects when local data was last successfully refreshed, not merely when a request was made.

## Error Handling

- if enqueueing fails in `web`, return an HTTP error
- if MCP fetch or import execution fails in `worker`, mark the job `failed`, persist `error_message`, and leave prior offers untouched
- if the worker process dies during execution, the job may remain `running`; stale-job recovery is out of scope for this change

## Testing Strategy

Regression coverage must include:

- route test: manual refresh enqueues or reuses a job and does not execute import inline
- worker execution test: pending refresh job runs through the shared refresh executor and writes success stats
- worker failure test: failed execution marks the job `failed` and stores `error_message`
- scheduler test: cron tick creates a scheduled refresh job from `REFRESH_CRON`
- scheduler de-duplication test: cron tick does nothing when a refresh is already `pending` or `running`
- GUI/render test: page includes manual refresh control and last updated timestamp data
- env/config test: new defaults and timezone parsing are covered

## Files Likely To Change

- `src/config/env.ts`
- `src/app/runtime.ts`
- `src/core/importing/run-import.ts`
- `src/db/repositories/import-jobs-repository.ts`
- `src/worker/run-worker.ts`
- `src/web/routes/import-routes.ts`
- `src/web/server.ts`
- `src/web/views/*.njk`
- `src/web/client/offers-app.tsx`
- `README.md`
- `docs/architecture.md`
- `docs/prd/README.md`
- `tests/**`

## Acceptance Criteria

- manual refresh no longer performs the full import inline in `web`
- worker executes pending refresh jobs end-to-end using the existing import pipeline
- scheduled refreshes are created from `REFRESH_CRON`
- `import_jobs` shows refresh lifecycle and import stats
- GUI shows a manual refresh button and the last successful update time
- scheduling and displayed timestamps honor the configured timezone
- tests cover enqueueing, worker execution, cron-triggered scheduling, and GUI status rendering
