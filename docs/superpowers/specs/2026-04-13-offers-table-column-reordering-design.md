# Offers Table Column Reordering Design

**Date:** 2026-04-13  
**Status:** proposed  
**Scope:** Add GUI support for changing offers table column order with drag and drop and persist the preferred order locally in the browser.

## Problem

The offers table already supports:

- sorting
- per-column filtering
- column visibility toggles
- inline editing for selected fields

That still leaves one important gap for scan-heavy use. The user cannot change the order of columns to put the most important information first.

The current fixed order is good as a default, but it is not optimal for every review workflow. Because this is a single-user local tool, the table should allow personal layout preferences without requiring any backend or database changes.

## Goals

- allow changing column order directly in the GUI
- use drag and drop on table headers as the primary interaction
- keep the existing default order as the initial state
- persist the chosen order across page reloads for the same browser
- keep sorting, filtering, visibility toggles, and inline editing working after reorder
- recover safely when the stored order is stale or invalid

## Non-Goals

- server-side persistence of layout preferences
- multi-user preference management
- changing the data model, API, or database schema
- adding a separate settings page for column order
- redesigning the offers table visual style beyond what is needed for DnD affordance

## Recommended Approach

Use TanStack Table controlled column ordering with a client-side `columnOrder` state. Render drag handles on column headers and update `columnOrder` when the user drops a header into a new position. Persist the ordered list of column ids in `localStorage`.

This keeps the feature entirely inside the existing client UI, matches the user's preferred direct-manipulation workflow, and avoids coupling a purely personal preference to the backend.

## Alternatives Considered

### 1. Column order editor outside the table

Pros:

- simpler DnD surface
- lower risk of conflict with header interactions

Cons:

- worse UX for a scan-first table
- extra UI surface to maintain
- less discoverable than dragging the header itself

### 2. Left/right buttons on each column

Pros:

- simpler implementation
- keyboard-friendly by default

Cons:

- too slow for wide tables
- noisy controls in every header
- does not match the requested DnD interaction

### 3. Header drag and drop with local persistence

Pros:

- most direct and intuitive
- keeps layout changes in the main workflow
- matches the request exactly

Cons:

- requires careful handling alongside sorting and filters
- needs defensive merge logic for stale saved order

This is the recommended option.

## User Experience

### Primary Interaction

The user drags a column header and drops it into a new position. The table updates immediately so the new order is visible in:

- header labels
- filter controls attached to headers
- row cells

The interaction should feel lightweight and local to the table, not like editing configuration in a separate panel.

### Persistence

The chosen order is stored in `localStorage` under a dedicated key for the offers table layout. On the next page load, the client restores that order before rendering the interactive table.

If there is no saved value, the table uses the current hard-coded default order.

### Column Visibility Compatibility

Hidden columns still keep their place in the stored order. If a hidden column is shown again later, it should appear in its saved position rather than being appended arbitrarily.

### Forward Compatibility

If the application gains a new column later, and the browser still has an older saved order, the new column is appended to the end after restoring the saved sequence. Removed columns from stale local storage are ignored.

## Technical Design

### State Model

Add a controlled `columnOrder` state in `src/web/client/offers-app.tsx` alongside the existing:

- `sorting`
- `columnFilters`
- `columnVisibility`

The initial value should come from:

1. the validated `localStorage` value, if available
2. otherwise the default order derived from the current column definitions

### Storage Format

Persist an array of column ids, for example:

```json
["stanowisko", "firma", "priorytet", "statusAplikacji"]
```

The storage reader must validate that the parsed value is an array of strings before using it.

### Reconciliation Logic

When loading the saved order:

- keep only ids that still exist in the current column set
- append any current columns missing from the saved array
- if parsing fails or the structure is invalid, fall back to default order

This prevents UI breakage when column definitions change between releases.

### Table Integration

TanStack Table should receive controlled `columnOrder` state so the rendered order remains the single source of truth across:

- headers
- cells
- visibility toggles
- filter rendering

The implementation should not manually reorder a separate header list or row list outside TanStack state.

### Drag and Drop Integration

The DnD layer should be attached to header cells or a dedicated drag handle inside them. A drag operation computes the source column id and target column id, then produces the next ordered array.

The preferred implementation is a lightweight browser-native drag and drop flow unless the existing codebase already depends on a DnD helper library. For this repository, adding a whole DnD library is unnecessary unless native behavior proves too brittle in tests.

### Interaction Safety

Sorting currently lives on the header surface, so the DnD behavior must not trigger accidental sort changes while dragging. The safest design is:

- click still sorts
- drag starts only after an actual drag gesture
- the drag handle advertises movability without taking over the whole header click target

## Error Handling

- invalid `localStorage` JSON: ignore and fall back to default order
- unknown column ids in saved order: ignore them
- missing ids for current columns: append them
- unavailable `localStorage`: fall back silently to default order

There is no user-facing error banner for these cases because this preference is optional and recoverable.

## Testing Strategy

Add client tests covering:

- default column order when no saved layout exists
- restored column order from valid `localStorage`
- fallback to default order for invalid stored data
- reconciliation when saved order is missing new columns
- reorder interaction updating the rendered header sequence
- persistence after reorder
- regression that visibility toggles still respect reordered columns
- regression that filtering and inline editing still work after reorder

## Implementation Notes

- keep the current default column definition order as the baseline
- do not change API payloads or server-rendered JSON
- keep persistence local to the browser because the product is explicitly single-user and local-first
- prefer small helper functions for loading, validating, reconciling, and saving column order so the main React component does not accumulate table-specific persistence logic inline

## Risks

### Header Interaction Conflicts

Drag behavior can interfere with sort clicks or filter controls if the drag surface is too broad.

Mitigation:

- use a narrow drag handle
- keep sort on normal header click
- add UI tests that exercise both sorting and reordering

### Brittle Persistence

Stored order can become stale as columns evolve.

Mitigation:

- reconcile saved order against the current column ids
- ignore invalid or removed ids
- append newly introduced columns automatically

### Test Environment Limitations

Browser DnD can be awkward in jsdom.

Mitigation:

- isolate reordering logic into a pure helper that can be tested directly
- use targeted interaction tests for the DOM contract that jsdom can support

## Definition of Done

- the user can reorder columns from the table GUI with drag and drop
- the new order is visible immediately in the full table
- the order persists across refreshes in the same browser
- stale or invalid stored order does not break the table
- existing table behavior continues to work after reorder
- tests cover the new behavior and key regressions
