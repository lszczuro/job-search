# Offers Table Column Filters Design

**Date:** 2026-04-09  
**Status:** proposed  
**Scope:** Replace the current global label filter with a per-column filtering system in the offers table.

## Problem

The offers table currently supports:

- sorting
- column visibility
- inline editing for selected columns
- a standalone global label filter based on generated labels

That is not enough for practical browsing. The user needs to combine filters across specific columns, for example:

- `Lokalizacja = Krakow`
- `Data dodania = 2026-04-09`
- multiple selected values for status-like fields

The current label toolbar is also structurally wrong for the target UX. It is global, not column-oriented, and does not scale when many values need to be shown inside a table header.

## Goals

- add TanStack Table column filter state for the offers table
- give each user-facing column an appropriate filter control or explicitly keep it non-filterable by design
- allow combining filters across multiple columns at once
- remove the current standalone global label filter
- make label filtering part of the column filtering system
- show active filters clearly and support clearing one filter or all filters
- keep filtering client-side and instant, without a full page reload
- document the new filtering behavior

## Non-Goals

- server-side filtering
- saving filters between page reloads
- advanced query-builder logic
- changing the data model or API surface

## Recommended Approach

Use TanStack Table `columnFilters` as the single filtering source of truth and attach filter metadata to column definitions. Render controls directly in table headers, but compress multi-value and range filters into dropdown-triggered controls instead of fully expanded chips or large inline forms.

This keeps filtering anchored to each column while preventing the table header from growing vertically when a column has many possible values.

## Alternatives Considered

### 1. Permanent filter row with fully inline controls

Pros:

- always visible
- simple mental model

Cons:

- too tall for wide tables
- label-like columns do not scale
- weak fit for dense, scan-first table UI

### 2. Separate filter toolbar above the table

Pros:

- visually compact table header
- simpler implementation

Cons:

- breaks the “filter per column” mental model
- makes it harder to associate a control with its column
- feels like a second UI system instead of part of the table

### 3. Header-attached filters with compressed dropdowns

Pros:

- matches per-column filtering requirements
- scales to large categorical value sets
- keeps the table compact

Cons:

- requires column metadata and custom control rendering

This is the recommended option.

## UI Design

### Layout

The table gets two filtering surfaces:

1. Column-level controls attached to table headers
2. An active-filters summary bar above the table

The header controls are the primary input surface. The summary bar is the visibility and reset surface.

### Header Controls

Each filterable column shows a control matched to its semantics:

- text columns: text input
- date columns: date input
- categorical columns: dropdown multi-select
- label-like columns: dropdown multi-select
- numeric columns: min/max range controls, shown in a compact dropdown

The default closed state should be compact:

- text and date filters remain visible inline
- dropdown filters show a short summary such as `2 wybrane`, `Python +2`, or the single selected value

The header should never attempt to render long lists of chips inline for label-heavy columns.

### Active Filters Bar

Above the table, show:

- result count
- a chip/tag style list of active filters
- `Wyczyść wszystkie`

Each active filter chip must be removable individually.

Examples:

- `Lokalizacja: Krakow`
- `Data dodania: 2026-04-09`
- `Status ogłoszenia: 🟢 Aktywne, ⏸️ Wstrzymane`
- `Notatki: Python`

## Column-by-Column Filter Map

| Column | Filter Type | Notes |
|---|---|---|
| `Stanowisko` | text contains | filters by job title text |
| `Status aplikacji` | categorical multi-select | values come from available row values / known options |
| `Data dodania` | exact date | compares day string in `YYYY-MM-DD` form |
| `Firma` | text contains | simple substring match |
| `Kontrakt` | categorical multi-select | values derived from current dataset |
| `Lokalizacja` | text contains | substring match is sufficient for now |
| `Notatki` | label multi-select | values come from parsed note labels |
| `Widełki od` | numeric range | min/max semantics |
| `Widełki do` | numeric range | min/max semantics |
| `Ostatnia weryfikacja` | exact date | compare on day only, ignoring time |
| `Priorytet` | categorical multi-select | values from known options / dataset |
| `Status ogłoszenia` | categorical multi-select | values from known options / dataset |
| `Tryb pracy` | categorical multi-select | values derived from current dataset |

At this stage every user-facing column remains filterable.

## Filter Semantics

### Across Columns

Filters combine with logical AND.

If the user sets:

- `Lokalizacja = Krakow`
- `Data dodania = 2026-04-09`

only rows matching both conditions remain visible.

### Within a Single Multi-Select Filter

Values combine with logical OR.

If the user selects:

- `🟢 Aktywne`
- `⏸️ Wstrzymane`

the table shows rows with either value in that column.

### Notes / Labels

`Notatki` uses parsed note labels from the existing offer view model.

Selected note labels combine with OR inside that column. Example:

- selecting `Python` and `AI` shows rows containing either `Python` or `AI`

This replaces the existing standalone label filter.

### Dates

- `Data dodania` compares exact day string
- `Ostatnia weryfikacja` compares only the date portion of the timestamp
- empty values do not match when a date filter is active

### Numeric Ranges

Numeric filters support:

- min only
- max only
- min and max together

Blank numeric bounds are ignored.

## Technical Design

### State

Replace the current external `activeLabels` state with TanStack Table `columnFilters`.

Keep:

- `sorting`
- `columnVisibility`
- existing inline edit state

Add:

- `columnFilters`

Remove:

- standalone global label filter state
- manual `filteredOffers` derived state

### Column Metadata

Each column definition gets filter metadata describing:

- whether the column is filterable
- which control type to render
- how to build available options when needed
- which TanStack filter function to use

This avoids hard-coding header UI separately from column definitions.

### Filter Functions

Implement custom filter functions for:

- case-insensitive text contains
- exact date match on normalized day strings
- multi-select categorical matching
- note-label matching
- numeric min/max ranges

These functions should operate directly on the serialized client-side offer data.

### Option Sources

Dropdown options come from one of two sources:

- existing known option lists for editable status-like fields where present
- unique values derived from the loaded offers dataset for the column

For `Notatki`, options come from parsed note labels across all offers.

## Data Flow

1. Server renders the same offers payload into the page.
2. Client initializes TanStack Table with sorting, visibility, and column filter state.
3. Header controls update `columnFilters`.
4. TanStack computes the filtered row model on the client.
5. The table and result count update immediately without reload.
6. The active-filters bar mirrors the current `columnFilters` state and exposes clear actions.

## Interaction Details

- changing any filter updates the table immediately
- clearing one filter updates only that column’s filter state
- `Wyczyść wszystkie` resets the entire column filter state
- sorting and column visibility continue to work with filters active
- inline editing remains available on visible rows after filtering

## Testing Strategy

Add representative UI tests for:

- filtering `Lokalizacja = Krakow`
- filtering `Data dodania = 2026-04-09`
- selecting multiple categorical values in one column
- filtering by `Notatki` through the new dropdown-based column filter
- clearing one filter
- clearing all filters

Existing tests that assert the old global label filter must be updated or replaced.

## Documentation Updates

Update README to describe:

- that the offers table now supports per-column filters
- available filter types
- that the old standalone global label filter has been replaced by column filters

## Risks and Mitigations

### Risk: Header UI becomes visually noisy

Mitigation:

- keep text/date filters compact
- use dropdowns for multi-select and range filters
- show details in the active-filters bar instead of in the header

### Risk: Filter logic becomes inconsistent across columns

Mitigation:

- centralize filter metadata
- implement shared filter helpers
- cover representative filter types in tests

### Risk: Date comparisons break on timestamp fields

Mitigation:

- normalize date values before comparison
- add a test for `Ostatnia weryfikacja` behavior if implementation touches that column’s filtering

## Definition of Done Mapping

- each user-facing column has an appropriate filter UI or is explicitly marked non-filterable
- filters combine across columns
- label filtering moves into the new column filter system
- filtering updates rows without reload
- tests cover location, date, and multi-value categorical filtering
- docs describe the new filter types and removal of the old global label filter
