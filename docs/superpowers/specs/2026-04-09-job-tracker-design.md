# Job Tracker Design

**Date:** 2026-04-09
**Status:** Drafted and user-validated in brainstorming

## Goal

Build a local web application for browsing and managing AI/LLM-related job offers imported from CzyJestEldorado, replacing the current Notion-based workflow.

The system is for a single private user, runs locally, uses SQLite for persistence, and must keep private user data out of the public repository by loading configuration from `.env` and an optional local `config.yaml`, both ignored by git when they contain user-specific values.

## Chosen Architecture

The project will use a monolith with a dedicated worker process.

This means:

- one shared codebase
- one SQLite database
- one Docker image
- two runtime processes:
  - `web` for HTTP, GUI, and API
  - `worker` for scheduled and manually triggered background imports

This approach keeps operational complexity low while separating interactive requests from background synchronization work.

## Alternatives Considered

### Functional Monolith in a Single Process

Pros:

- simplest deployment model
- fewer moving parts

Cons:

- background imports and scheduler share the same runtime as interactive HTTP traffic
- weaker runtime separation for long-running or failing imports

### Monolith With Dedicated Worker

Pros:

- keeps a single codebase and local deployment model
- clean separation between HTTP handling and background jobs
- supports both scheduled and manual refresh through one shared import pipeline

Cons:

- slightly more setup than a single-process app

### Separate Frontend and Backend Applications

Pros:

- strong technical separation

Cons:

- unnecessary complexity for a local single-user tool
- more build and deployment surface without proportional value

## Module Boundaries

Recommended source layout:

- `src/web`
  HTTP routes, HTML rendering, HTMX handlers, API endpoints
- `src/worker`
  Scheduler and background job execution
- `src/core/jobs`
  Job offer domain model, enums, and domain rules
- `src/core/filtering`
  Matching logic for profile fit, location, priority, and generated notes
- `src/core/importing`
  Shared import orchestration for API and CSV sources
- `src/adapters/czyjesteldorado`
  External API client and payload mapping
- `src/adapters/csv`
  CSV parsing and row mapping from Notion export format
- `src/adapters/db`
  Drizzle schema, migrations, repositories, and persistence mapping
- `src/config`
  Configuration loading from `.env` and optional local `config.yaml`
- `src/common`
  Shared helpers and cross-cutting utilities kept intentionally small

Boundary rules:

- `web` must not contain import business logic
- `worker` must not contain GUI logic
- `core` must not depend on HTTP or concrete storage details
- adapters translate between external formats and internal domain structures

## Runtime Design

### Web Process

Responsibilities:

- serve the local GUI
- expose REST and HTMX endpoints
- allow filtering, sorting, searching, and detail viewing
- allow inline updates of editable fields
- create background import jobs for manual refresh and CSV import
- fetch and display background job status and results

### Worker Process

Responsibilities:

- run scheduled refreshes
- process pending import jobs
- execute the full import pipeline
- persist import statistics and failures

### SQLite

Responsibilities:

- store offers
- store background job state
- preserve user edits across refreshes

## Data Model

### `job_offers`

Primary offer storage. Required fields:

- `id`
- `stanowisko`
- `firma`
- `url` unique
- `widełki_od`
- `widełki_do`
- `lokalizacja`
- `tryb_pracy`
- `kontrakt`
- `status_ogloszenia`
- `status_aplikacji`
- `priorytet`
- `notatki`
- `data_dodania`
- `ostatnia_weryfikacja`
- `created_at`

Additional technical fields:

- `source`
- `source_external_id`
- `updated_at`

These technical fields improve traceability and future extensibility without changing the user-facing domain model.

### `import_jobs`

Tracks background work initiated by scheduler or user actions.

Fields:

- `id`
- `kind` with values `scheduled_refresh`, `manual_refresh`, `csv_import`
- `status` with values `pending`, `running`, `succeeded`, `failed`
- `requested_by` with values such as `system` or `user`
- `payload` JSON payload for source-specific parameters
- `stats_fetched`
- `stats_added`
- `stats_rejected`
- `stats_duplicates`
- `error_message`
- `created_at`
- `started_at`
- `finished_at`

## Core Contracts

### `ImportCommand`

Input to the import pipeline:

- `kind`
- `source`
- `trigger`
- `payload`

### `ImportResult`

Output from one import execution:

- `fetched`
- `added`
- `rejected`
- `duplicates`
- `errors`

### `OfferFilterDecision`

Decision returned for each offer:

- `accepted`
- `rejection_reason`
- `priority`
- `generated_notes`

## Import Flow

Both API import and CSV import must use the same shared flow:

1. Source adapter loads and maps raw offers.
2. Filtering layer evaluates profile fit and location rules.
3. Priority and generated notes are derived from the offer content and local configuration.
4. Deduplication is applied using `url`.
5. Accepted and non-duplicate offers are written to the database.
6. Import statistics are stored in `import_jobs`.

Manual refresh flow:

1. User clicks refresh in the GUI.
2. `web` creates a `manual_refresh` record in `import_jobs`.
3. `worker` picks the pending job and runs the import pipeline.
4. `worker` updates status and statistics.
5. `web` displays the final result by polling or requesting job status.

Scheduled refresh flow:

1. Scheduler creates a `scheduled_refresh` job.
2. Worker executes the same pipeline used for manual refresh.

CSV flow:

1. User triggers CSV import through CLI or HTTP endpoint.
2. `web` creates a `csv_import` job with source-specific payload.
3. `worker` executes the same core import flow with the CSV adapter.

## Filtering Rules

### Position Matching

An offer is accepted only if its title or description matches the user profile defined in configuration.

### Location Matching

An offer is accepted only if:

- work mode is `Remote`, regardless of location
- or work mode is `Office` or `Hybrid` and the location maps to one of the accepted Upper Silesia cities:
  - Gliwice
  - Katowice
  - Chorzow
  - Ruda Slaska
  - Zabrze
  - Sosnowiec
  - Bytom
  - Siemianowice Slaskie

Office or hybrid offers from other cities are rejected.

### Priority Calculation

Priority is generated from the offer stack compared with the user-known stack configured locally:

- `🔥 Teraz` when the offer mostly matches technologies known by the user
- `⏳ Za miesiąc` when the offer mixes familiar and unfamiliar technologies
- `👀 Obserwuj` when the offer is mostly outside the user stack

### Generated Notes

Notes generated during import must list technologies mentioned in the offer that are not present in the user CV or known-stack configuration.

Generated notes are only the initial value. The user can later edit notes manually, and refresh jobs must not overwrite those edits.

## GUI Scope

The GUI is a local web interface available on `http://localhost:<port>`.

Recommended UI approach:

- server-rendered HTML
- partial updates via HTMX
- no separate SPA

### List View

Must support:

- display of stanowisko, firma, priorytet, lokalizacja, tryb pracy, widełki, status ogloszenia, status aplikacji, data dodania
- filtering by priorytet, tryb pracy, lokalizacja, status aplikacji, kontrakt
- sorting by data dodania, widełki, priorytet
- text search over stanowisko and firma

### Detail View

Must support:

- all offer fields
- inline editing of `notatki`
- inline editing of `status_aplikacji`
- inline editing of `status_ogloszenia`
- inline editing of `priorytet`
- link to the original offer opened in a new tab

### Refresh Action

The refresh action must:

- trigger a background import
- return or display the job identifier immediately
- show the final result:
  - how many offers were fetched
  - how many were added
  - how many were rejected by profile rules
  - how many duplicates were skipped

## CSV Import

The system must support one-time import of historical data from a CSV file matching the Notion export layout.

Expected headers:

`Stanowisko,Status aplikacji,Data dodania,Firma,URL,Kontrakt,Lokalizacja,Notatki,Widełki od,Widełki do,Ostatnia weryfikacja,Priorytet,Status ogłoszenia,Tryb pracy`

Requirements:

- import can be triggered manually through CLI or `POST /import/csv`
- deduplication by `url` behaves exactly like API imports
- valid rows are imported even if some rows are invalid
- invalid rows are reported in import results

## Technology Choices

Chosen stack:

- Node.js 22
- TypeScript
- Fastify
- Drizzle ORM with drizzle-kit
- SQLite via `better-sqlite3`
- scheduler in worker using a lightweight cron-based approach
- built-in `fetch` or `undici` for API access
- `csv-parse` for CSV import
- server-rendered templates with HTMX for GUI interactions
- Vitest for unit and integration tests
- Docker and docker-compose for local deployment

Reasons:

- Node.js matches user preference
- TypeScript reduces errors in enum-heavy domain logic
- Fastify keeps the web layer lightweight
- Drizzle is a good fit for SQLite and migration-driven development
- HTMX avoids the overhead of a separate SPA while still supporting inline interactions

## Deployment Model

Deployment uses Docker with a shared application image and a compose file.

Compose will run:

- `web`
- `worker`
- a shared volume for SQLite persistence

This keeps a single deployable codebase while preserving runtime separation.

## Error Handling and Edge Cases

- If CzyJestEldorado is unavailable, the import job fails, the error is stored, and existing offers remain unchanged.
- If part of the upstream payload is malformed, invalid offers are skipped while valid offers continue through the pipeline.
- Missing salary ranges are allowed.
- Remote offers pass location matching even if their textual location is outside the accepted city set.
- Office or hybrid offers with ambiguous or unmapped location values are treated as outside the accepted geography.
- Duplicate URLs never overwrite existing records.
- User-edited notes, application status, posting status, and manual priority changes must survive future refreshes.
- Only one active import job of a given type should run at a time. Concurrent jobs wait in `pending`.
- Offers removed from the source are not automatically deleted locally.

## Testing Scope

The MVP test suite should cover:

- filtering logic for position and location
- priority calculation
- generated note calculation
- deduplication behavior
- API import integration
- CSV import integration
- key HTTP endpoints for list, detail, inline update, and refresh trigger

Optional after MVP:

- a few Playwright end-to-end flows for GUI smoke coverage

## MVP Definition

The MVP includes:

- SQLite schema and migrations
- CzyJestEldorado client using the public API if documentation and live response confirm availability
- shared import pipeline with filtering, deduplication, priority, and generated notes
- scheduled refresh in worker
- CSV import
- REST and HTMX endpoints for GUI support
- local GUI with list view, detail view, inline editing, filters, sorting, and refresh action
- Dockerfile
- docker-compose configuration
- `.env.example`
- README with setup and usage instructions

The MVP excludes:

- notifications
- other job sources
- export features
- authentication
- public deployment
