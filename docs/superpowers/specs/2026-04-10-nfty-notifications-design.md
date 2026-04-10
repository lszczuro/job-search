# Nfty Notifications Design

## Goal

Publish one nfty notification for each worker refresh run that adds at least one new offer.

## Scope

This design covers:

- optional nfty configuration in environment variables
- one notification per successful worker refresh run when `added > 0`
- notification authentication with Basic Auth
- notification click-through URL from environment configuration
- failure isolation so nfty delivery does not fail the refresh job

This design does not add per-offer notifications, notification retries, delivery persistence, or UI controls for notifications.

## Current State

- the worker executes refresh jobs and records import stats in `import_jobs`
- `runRefreshJob` returns aggregate counts including `added`
- there is no outbound notification integration after refresh completion

## Design Summary

The worker will remain the only process responsible for refresh side effects after import completion.

After a refresh job succeeds:

1. Worker executes `runRefreshJob`
2. Worker checks `result.added`
3. If `added === 0`, worker skips nfty
4. If `added > 0` and nfty env is enabled, worker sends one POST request to nfty
5. Worker marks the import job as `succeeded` regardless of nfty delivery outcome

This keeps notification delivery coupled to real imported results without affecting refresh job success semantics.

## Configuration

Add optional environment variables:

- `NFTY_ENDPOINT`
- `NFTY_LOGIN`
- `NFTY_PASSWORD`
- `NFTY_CLICK_URL`

### Enablement rules

- nfty integration is enabled only when `NFTY_ENDPOINT` is present
- missing `NFTY_LOGIN` or `NFTY_PASSWORD` disables the integration rather than failing startup
- `NFTY_CLICK_URL` is optional; when present, the notification includes the click target header expected by nfty

## Notification Contract

### Request

The worker sends:

- method: `POST`
- URL: `NFTY_ENDPOINT`
- body: summary text describing how many new offers were found
- authorization header: `Basic ${base64(login:password)}`
- click header: nfty action/header pointing to `NFTY_CLICK_URL` when configured

### Message body

- `Znaleziono 1 nową ofertę`
- `Znaleziono X nowe oferty`

The notification body intentionally uses the aggregate count from the completed run instead of individual offer titles.

## Architecture

### Env parsing

`src/config/env.ts` will expose parsed nfty config alongside the existing refresh settings.

### Worker integration point

`src/worker/run-worker.ts` will own the notification side effect because it already coordinates refresh execution outcomes.

The worker success path becomes:

1. fetch pending job
2. mark running
3. execute refresh job
4. optionally send nfty notification
5. mark succeeded

### Runtime helper

`src/app/runtime.ts` will provide a helper for sending nfty notifications so `run-worker` does not assemble HTTP details inline.

This helper will:

- no-op when nfty is disabled
- build the request body from `added`
- encode Basic Auth
- include the click URL header when configured

## Error Handling

- nfty delivery failures must not mark the refresh job as failed
- worker should log a concise error to stderr or `console.error`
- refresh job failure semantics remain tied only to refresh execution failure, not notification delivery

## Testing Strategy

Regression coverage must include:

- env parsing test for new optional nfty variables
- worker test proving notification is skipped when `added === 0`
- worker test proving one notification is sent when `added > 0`
- worker test proving refresh job still succeeds when notification delivery throws
- runtime/helper test proving Basic Auth and click URL header are built correctly

## Files Likely To Change

- `src/config/env.ts`
- `src/app/runtime.ts`
- `src/worker/run-worker.ts`
- `.env.example`
- `README.md`
- `tests/config/env.test.ts`
- `tests/worker/run-worker.test.ts`
- additional tests near runtime helpers if needed

## Acceptance Criteria

- a successful worker refresh with `added === 0` sends no nfty notification
- a successful worker refresh with `added > 0` sends exactly one nfty notification
- notification text contains only the aggregate count for the run
- nfty authentication uses Basic Auth from env credentials
- notification click-through target comes from env configuration when provided
- nfty delivery errors do not fail the import job
- automated tests cover enablement, success, skip, and failure-isolated behavior
