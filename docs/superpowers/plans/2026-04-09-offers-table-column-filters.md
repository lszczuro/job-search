# Offers Table Column Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the global label filter with a per-column TanStack Table filtering system that supports text, date, categorical, label, and numeric range filters in the offers table.

**Architecture:** Keep filtering fully client-side in `src/web/client/offers-app.tsx` by moving from custom `activeLabels` filtering to TanStack Table `columnFilters` plus custom `filterFn` helpers. Render compact filter controls in table headers, use dropdowns for multi-value and range filters, and mirror active filter state above the table with per-filter and global clear actions.

**Tech Stack:** TypeScript, React 19, TanStack Table, Vitest, Testing Library, Nunjucks README docs

---

### Task 1: Lock The New Filter Behavior With Failing Tests

**Files:**
- Modify: `tests/web/offers-app.test.ts`

- [ ] **Step 1: Add a failing location filter test**

```ts
it("filters rows by location from the column filter controls", async () => {
  document.body.innerHTML = `
    <div id="offers-app"></div>
    <script id="initial-offers" type="application/json">${JSON.stringify(offers)}</script>
  `;

  await import("../../src/web/client/offers-app");

  fireEvent.change(await screen.findByLabelText("Filtr Lokalizacja"), {
    target: { value: "Krakow" }
  });

  expect(screen.getByText("1 / 2 ofert")).toBeTruthy();
  expect(screen.getByText("AI Engineer")).toBeTruthy();
  expect(screen.queryByText("Platform Engineer")).toBeNull();
});
```

- [ ] **Step 2: Add a failing date filter test**

```ts
it("filters rows by exact date added", async () => {
  document.body.innerHTML = `
    <div id="offers-app"></div>
    <script id="initial-offers" type="application/json">${JSON.stringify(offers)}</script>
  `;

  await import("../../src/web/client/offers-app");

  fireEvent.change(await screen.findByLabelText("Filtr Data dodania"), {
    target: { value: "2026-04-09" }
  });

  expect(screen.getByText("1 / 2 ofert")).toBeTruthy();
  expect(screen.getByText("AI Engineer")).toBeTruthy();
  expect(screen.queryByText("Platform Engineer")).toBeNull();
});
```

- [ ] **Step 3: Add a failing multi-value categorical filter test**

```ts
it("filters rows by multiple selected status values", async () => {
  document.body.innerHTML = `
    <div id="offers-app"></div>
    <script id="initial-offers" type="application/json">${JSON.stringify(offersWithThreeStatuses)}</script>
  `;

  await import("../../src/web/client/offers-app");

  fireEvent.click(await screen.findByRole("button", { name: "Filtr Status ogłoszenia" }));
  fireEvent.click(await screen.findByLabelText("🟢 Aktywne"));
  fireEvent.click(await screen.findByLabelText("⏸️ Wstrzymane"));

  expect(screen.getByText("2 / 3 ofert")).toBeTruthy();
  expect(screen.queryByText("Closed Role")).toBeNull();
});
```

- [ ] **Step 4: Add a failing notes filter and clear-actions test**

```ts
it("filters note labels from the notes column and clears active filters", async () => {
  document.body.innerHTML = `
    <div id="offers-app"></div>
    <script id="initial-offers" type="application/json">${JSON.stringify(offers)}</script>
  `;

  await import("../../src/web/client/offers-app");

  fireEvent.click(await screen.findByRole("button", { name: "Filtr Notatki" }));
  fireEvent.click(await screen.findByLabelText("Python"));

  expect(screen.getByText("Notatki: Python")).toBeTruthy();
  expect(screen.getByText("1 / 2 ofert")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Wyczyść wszystkie filtry" }));

  expect(screen.getByText("2 / 2 ofert")).toBeTruthy();
});
```

- [ ] **Step 5: Remove or replace old global-label-filter assertions**

```ts
// Delete tests that click the top-level "Python" label chip outside the new column filter system.
// Replace them with the new per-column Notatki filter assertions above.
```

- [ ] **Step 6: Run the targeted UI test file and verify it fails for the new filter assertions**

Run: `npm test -- tests/web/offers-app.test.ts`

Expected: FAIL on missing filter controls such as `Filtr Lokalizacja`, `Filtr Data dodania`, or `Filtr Notatki`

- [ ] **Step 7: Commit the red test work**

```bash
git add tests/web/offers-app.test.ts
git commit -m "test: cover offers table column filters"
```

### Task 2: Introduce Filter Types, State, And TanStack Filter Functions

**Files:**
- Modify: `src/web/client/offers-app.tsx`
- Modify: `src/web/offer-view-model.ts`
- Test: `tests/web/offers-app.test.ts`

- [ ] **Step 1: Add filter value types near the top of `src/web/client/offers-app.tsx`**

```ts
type MultiSelectFilterValue = string[];
type NumericRangeFilterValue = { min?: string; max?: string };

type OfferColumnFilterMeta = {
  filterVariant?: "text" | "date" | "multi-select" | "note-select" | "number-range";
  filterLabel?: string;
  getOptions?: (offers: OfferListItem[]) => string[];
};
```

- [ ] **Step 2: Replace the old standalone label filter state**

```ts
const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
```

Delete:

```ts
const [activeLabels, setActiveLabels] = useState<string[]>([]);
const filteredOffers = useMemo(() => /* old manual label filtering */, [activeLabels, offers]);
```

- [ ] **Step 3: Add helper normalizers and option builders**

```ts
function normalizeDate(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function buildUniqueOptions(values: Array<string | null | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b));
}
```

- [ ] **Step 4: Add TanStack filter functions**

```ts
const textIncludesFilter: FilterFn<OfferListItem> = (row, columnId, value) => {
  const cellValue = String(row.getValue(columnId) ?? "").toLowerCase();
  return cellValue.includes(String(value ?? "").toLowerCase());
};

const exactDateFilter: FilterFn<OfferListItem> = (row, columnId, value) => {
  const cellValue = normalizeDate(String(row.getValue(columnId) ?? ""));
  return !value ? true : cellValue === value;
};

const multiSelectFilter: FilterFn<OfferListItem> = (row, columnId, value: string[]) => {
  if (!value?.length) return true;
  return value.includes(String(row.getValue(columnId) ?? ""));
};

const notesFilter: FilterFn<OfferListItem> = (row, _columnId, value: string[]) => {
  if (!value?.length) return true;
  const labels = getOfferNoteLabels(row.original);
  return value.some((item) => labels.includes(item));
};

const numberRangeFilter: FilterFn<OfferListItem> = (row, columnId, value: NumericRangeFilterValue) => {
  const rawValue = row.getValue(columnId);
  const numericValue = typeof rawValue === "number" ? rawValue : Number(rawValue);
  if (Number.isNaN(numericValue)) return false;
  if (value.min && numericValue < Number(value.min)) return false;
  if (value.max && numericValue > Number(value.max)) return false;
  return true;
};
```

- [ ] **Step 5: Move the table to TanStack filtered rows**

```ts
const table = useReactTable({
  data: offers,
  columns,
  state: { sorting, columnVisibility, columnFilters },
  onSortingChange: setSorting,
  onColumnVisibilityChange: setColumnVisibility,
  onColumnFiltersChange: setColumnFilters,
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getSortedRowModel: getSortedRowModel()
});
```

- [ ] **Step 6: Run the targeted tests and confirm they still fail, but now on missing header UI rather than missing filter state**

Run: `npm test -- tests/web/offers-app.test.ts`

Expected: FAIL on UI queries such as missing buttons or labels for specific filters

- [ ] **Step 7: Commit the TanStack filter-state foundation**

```bash
git add src/web/client/offers-app.tsx src/web/offer-view-model.ts tests/web/offers-app.test.ts
git commit -m "refactor: add offers table column filter state"
```

### Task 3: Add Column Metadata And Render Compact Header Filter Controls

**Files:**
- Modify: `src/web/client/offers-app.tsx`
- Test: `tests/web/offers-app.test.ts`

- [ ] **Step 1: Extend column definitions with filter metadata**

```ts
{
  accessorKey: "lokalizacja",
  header: "Lokalizacja",
  meta: {
    filterVariant: "text",
    filterLabel: "Filtr Lokalizacja"
  } satisfies OfferColumnFilterMeta
}
```

Use the same pattern for:

- `stanowisko` -> `text`
- `firma` -> `text`
- `dataDodania` -> `date`
- `ostatniaWeryfikacja` -> `date`
- `kontrakt` -> `multi-select`
- `trybPracy` -> `multi-select`
- `statusAplikacji` -> `multi-select`
- `priorytet` -> `multi-select`
- `statusOgloszenia` -> `multi-select`
- `notatki` -> `note-select`
- `widełkiOd` -> `number-range`
- `widełkiDo` -> `number-range`

- [ ] **Step 2: Add a compact header filter renderer**

```tsx
function renderColumnFilter(column: Column<OfferListItem, unknown>, offers: OfferListItem[]) {
  const meta = column.columnDef.meta as OfferColumnFilterMeta | undefined;
  if (!meta?.filterVariant) {
    return null;
  }

  if (meta.filterVariant === "text") {
    return (
      <input
        aria-label={meta.filterLabel}
        className="filter-input"
        onChange={(event) => column.setFilterValue(event.target.value)}
        value={(column.getFilterValue() as string) ?? ""}
      />
    );
  }

  return <FilterDropdown column={column} meta={meta} offers={offers} />;
}
```

- [ ] **Step 3: Add a reusable dropdown component for multi-select and range filters**

```tsx
function FilterDropdown({
  column,
  meta,
  offers
}: {
  column: Column<OfferListItem, unknown>;
  meta: OfferColumnFilterMeta;
  offers: OfferListItem[];
}) {
  const [open, setOpen] = useState(false);
  const selected = (column.getFilterValue() as string[] | NumericRangeFilterValue | undefined) ?? undefined;

  return (
    <div className="filter-dropdown">
      <button
        aria-expanded={open}
        aria-label={meta.filterLabel}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {getFilterSummary(meta, selected)}
      </button>
      {open ? renderDropdownPanel(column, meta, offers) : null}
    </div>
  );
}
```

- [ ] **Step 4: Implement the `Notatki` dropdown as checkbox options, not inline chips**

```tsx
const noteOptions = buildUniqueOptions(offers.flatMap((offer) => getOfferNoteLabels(offer)));
```

Panel behavior:

- render checkbox per note label
- update `column.setFilterValue(nextValues)`
- closed-state summary shows `Python`, `Python +2`, or `Wybierz`

- [ ] **Step 5: Render header labels and filter controls together**

```tsx
<th key={header.id}>
  <button onClick={header.column.getToggleSortingHandler()} type="button">
    {flexRender(header.column.columnDef.header, header.getContext())}
  </button>
  {renderColumnFilter(header.column, offers)}
</th>
```

- [ ] **Step 6: Add active filters summary and clear actions above the table**

```tsx
<div className="active-filters">
  <span>{table.getRowModel().rows.length} / {offers.length} ofert</span>
  {table.getState().columnFilters.map((filter) => (
    <button key={filter.id} onClick={() => table.getColumn(filter.id)?.setFilterValue(undefined)} type="button">
      {formatActiveFilter(filter)}
    </button>
  ))}
  <button onClick={() => setColumnFilters([])} type="button">
    Wyczyść wszystkie filtry
  </button>
</div>
```

- [ ] **Step 7: Run the focused UI tests and confirm they pass**

Run: `npm test -- tests/web/offers-app.test.ts`

Expected: PASS

- [ ] **Step 8: Commit the filter UI**

```bash
git add src/web/client/offers-app.tsx tests/web/offers-app.test.ts
git commit -m "feat: add per-column offer filters"
```

### Task 4: Polish Filter Semantics, Update Docs, And Record Required Artifacts

**Files:**
- Modify: `README.md`
- Modify: `tasks/tasks.yaml`
- Modify: `logs/events.jsonl`
- Add: `tasks/test-report-offers-table-column-filters.md`
- Add: `tasks/review-offers-table-column-filters.md`
- Add: `tasks/security-offers-table-column-filters.md`
- Test: `tests/web/offers-app.test.ts`

- [ ] **Step 1: Update the README filtering section**

Add bullets like:

```md
- per-column filters in table headers
- text filters for text columns
- date filters for `Data dodania` and `Ostatnia weryfikacja`
- dropdown multi-select filters for status, notes, contract, and work mode columns
- numeric range filters for salary columns
- active filter summary with clear actions
```

Replace the old line about global label filtering.

- [ ] **Step 2: Record the task in `tasks/tasks.yaml`**

Add an entry shaped like:

```yaml
- task_id: offers-table-column-filters
  goal: Add per-column filtering to the offers table and replace the global label filter.
  depends_on: []
  stack: typescript
  owner_role: implementer
  target_paths:
    - src/web/client/offers-app.tsx
    - src/web/offer-view-model.ts
    - tests/web/offers-app.test.ts
    - README.md
  definition_of_done: User can combine per-column filters across the offers table, clear them without reload, and use the notes column instead of the old global label filter.
  status: completed
  artifacts:
    spec: docs/superpowers/specs/2026-04-09-offers-table-column-filters-design.md
    plan: docs/superpowers/plans/2026-04-09-offers-table-column-filters.md
    test_report: tasks/test-report-offers-table-column-filters.md
    review_notes: tasks/review-offers-table-column-filters.md
    security_report: tasks/security-offers-table-column-filters.md
    event_log: logs/events.jsonl
```

- [ ] **Step 3: Append an event log entry**

```json
{"timestamp":"2026-04-09T00:00:00.000Z","task_id":"offers-table-column-filters","event":"implementation_completed","status":"completed","verification":{"tests":"npm test -- tests/web/offers-app.test.ts","build":"npm run build"}}
```

- [ ] **Step 4: Write the test report, review notes, and security report**

Create concise artifacts:

- `tasks/test-report-offers-table-column-filters.md`
- `tasks/review-offers-table-column-filters.md`
- `tasks/security-offers-table-column-filters.md`

Include:

- commands run
- pass/fail outcome
- behavior covered
- any residual UI or security risk

- [ ] **Step 5: Run focused verification and the project build**

Run:

```bash
npm test -- tests/web/offers-app.test.ts
npm run build
```

Expected:

- UI tests PASS
- TypeScript build exits 0

- [ ] **Step 6: Commit docs and artifact updates**

```bash
git add README.md tasks/tasks.yaml logs/events.jsonl tasks/test-report-offers-table-column-filters.md tasks/review-offers-table-column-filters.md tasks/security-offers-table-column-filters.md
git commit -m "docs: record offers table filter rollout"
```

## Self-Review

- Spec coverage: the plan covers TanStack `columnFilters`, compact header controls, dropdown label handling, active-filter visibility, clear actions, tests, docs, and task artifacts.
- Placeholder scan: all tasks use concrete file paths, commands, and expected behaviors; no `TODO` or deferred implementation markers remain.
- Type consistency: the same `columnFilters`, `OfferColumnFilterMeta`, `FilterDropdown`, and report artifact names are used consistently across tasks.
