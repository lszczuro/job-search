# Inline Offer Editing Design

## Goal

Allow the user to update offer metadata from the offers table without leaving the main list view.

## Scope

- inline editing for `status_aplikacji`
- inline editing for `priorytet`
- inline editing for `status_ogloszenia`
- inline editing for `notatki`
- PATCH submission to `/offers/:id`
- visible save and error feedback
- local state refresh after save without full page reload
- tests for UI behavior and SQLite persistence
- README update

## Chosen Approach

Keep editing inside the existing React + TanStack table and use explicit save controls per row.

This fits the current product rule that the interface should optimize for scanning many offers at once. It also keeps the change small because the existing route contract already supports updates and the table already owns client-side offer state.

## Interaction Model

- editable table cells render native controls
- select controls are used for `status_aplikacji`, `priorytet`, and `status_ogloszenia`
- `notatki` uses a compact text input
- a row becomes dirty when any editable field differs from the last saved value
- dirty rows expose a `Zapisz` button
- while saving, the row shows `Zapisywanie...`
- after success, the row shows `Zapisano`
- after failure, the row shows an inline error message and remains editable

## Data Flow

1. The page loads the initial offers JSON exactly as today.
2. The React client keeps offers in local state instead of treating them as read-only.
3. Editing updates a draft copy for the row.
4. Saving sends only changed editable fields to `PATCH /offers/:id`.
5. On success, the saved values replace the current offer row in local state.
6. Derived labels and filters recompute from the updated offer state.
7. On reload, the latest values come back from SQLite through the existing list query.

## Error Handling

- disable the save button during a pending request
- preserve user edits on failure
- show an inline error message when the request fails or returns `{ ok: false }`
- treat a non-2xx response as a failed save

## Testing

- frontend test for inline editing, PATCH payload, and success feedback
- frontend test for visible error feedback
- server/runtime persistence test proving a patched value is returned by a later `GET /offers`
- README documentation update for editable fields
