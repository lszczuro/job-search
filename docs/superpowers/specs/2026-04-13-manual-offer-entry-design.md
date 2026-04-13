# Manual Offer Entry Design

## Goal

Allow the user to add a job offer manually from the GUI when they applied outside the worker import flow.

## Scope

- add a `Dodaj ręcznie` action in the offers page toolbar
- open a modal with a compact manual entry form
- require `stanowisko`, `firma`, and `url`
- persist the record into the existing `job_offers` table
- set sensible server-side defaults for the remaining required fields
- prevent duplicates by existing `url` uniqueness
- update the table immediately after a successful create without full page reload
- show validation and submit errors inside the modal
- add tests for persistence, validation, duplicate rejection, and UI behavior

## Chosen Approach

Use a short modal form with only the three required inputs and server-side defaults for the rest.

This keeps the feature aligned with the current scan-first table UI. The modal avoids overloading the first table row, avoids conflict with the linked title column, and keeps manual entry fast enough for the intended local single-user workflow.

## Interaction Model

- the offers toolbar gets a new `Dodaj ręcznie` button
- clicking the button opens a modal dialog
- the modal contains required inputs for:
  - `stanowisko`
  - `firma`
  - `url`
- the modal contains `Anuluj` and `Dodaj rekord` actions
- submit is disabled while a request is in flight
- after success:
  - the modal closes
  - the new record is inserted into local table state without a full reload
  - the user remains on the main offers list
- after failure:
  - the modal stays open
  - entered values are preserved
  - a visible inline error message explains the problem

## Data Model and Defaults

The new record is stored in the existing `job_offers` table. No new entity type is introduced.

Manual records are distinguished through `source = manual` so that existing list rendering, filters, and inline editing continue to operate on one shared offer model.

Required values from the form:

- `stanowisko`
- `firma`
- `url`

Server-side defaults for the remaining required fields:

- `status_aplikacji = 📋 Zapisana`
- `priorytet = 🔥 Teraz`
- `status_ogloszenia = 🟢 Aktywne`

Additional required fields not exposed in the modal should be filled explicitly by the server so implementation is deterministic:

- `lokalizacja = Brak danych`
- `tryb_pracy = Nieznany`
- `kontrakt = Nieznany`
- `notatki = ""`
- `data_dodania = current timestamp`
- `ostatnia_weryfikacja = current timestamp`
- `source = manual`
- `source_external_id = null`
- `created_at = current timestamp`
- `updated_at = current timestamp`

## API and Data Flow

Add `POST /offers` for manual offer creation.

Request body:

- `stanowisko`
- `firma`
- `url`

Behavior:

1. The frontend opens the modal from the offers page.
2. The user submits the three required fields.
3. The server validates required fields and URL format.
4. The server creates a `job_offers` row using submitted values plus defaults and generated metadata.
5. If the `url` already exists, the server returns a business error instead of creating a duplicate row.
6. On success, the frontend appends the created offer to local state so the table updates immediately.

## Error Handling

- client-side required field validation is allowed for fast feedback, but server validation remains authoritative
- invalid URL returns a user-facing validation error
- duplicate `url` returns a user-facing conflict error
- unexpected server failure returns a generic inline save error
- failed submission never clears the form

## Testing

- repository/runtime test proving manual creation persists and can be listed later
- server test covering:
  - required field validation
  - invalid URL rejection
  - duplicate `url` rejection
  - default field population
- frontend test covering:
  - opening and closing the modal
  - successful submit and optimistic table update
  - visible error handling for failed submit

## Out of Scope

- editing every offer field during initial manual create
- a dedicated `/offers/new` page
- a separate table or workflow for manually added offers
- bulk manual import
