# Review Notes: Offers Table Column Filters

## Changes

- `src/web/client/offers-app.tsx`: replaced `activeLabels` global filter with TanStack `columnFilters` state; added `getFilteredRowModel`; extended column definitions with `filterFn` and `meta`; added `FilterDropdown` component and `renderColumnFilter` helper; added second `<tr>` in `<thead>` using `<td>` elements for filter controls; added active filters bar above table
- `README.md`: updated feature list and filtering section

## Design Decisions

- Filter controls sit in a second `<tr>` inside `<thead>` using `<td>` elements (not `<th>`) to keep `columnheader` role clean for tests and accessibility
- Dropdown options for `statusOgloszenia`, `statusAplikacji`, `priorytet` come from hardcoded constants (including values not yet present in data, e.g. `⏸️ Wstrzymane`) so users can filter proactively
- Options for `kontrakt`, `trybPracy` are derived dynamically from loaded offers
- Notes options are parsed from `notatki` field across all offers via `getOfferNoteLabels`
- Setting filter value to `undefined` (not empty string/array) removes it from `columnFilters` state
- Active filter chips show individual clear buttons plus a global "Wyczyść wszystkie filtry" button

## No Residual Issues
