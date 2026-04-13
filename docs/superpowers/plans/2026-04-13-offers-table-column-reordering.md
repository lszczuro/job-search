# Offers Table Column Reordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drag-and-drop column reordering to the offers table and persist the preferred column order in the browser without breaking filtering, visibility toggles, sorting, or inline editing.

**Architecture:** Keep TanStack Table as the single source of truth for rendered column order by introducing controlled `columnOrder` state in `src/web/client/offers-app.tsx`. Extract persistence and reorder logic into small helpers so storage validation and array reconciliation stay testable outside the React component, then wire header-level drag events to update that state and save it to `localStorage`.

**Tech Stack:** React 19, TanStack Table v8, TypeScript, Vitest, Testing Library, jsdom

---

## File Map

- Modify: `src/web/client/offers-app.tsx`
  Add `columnOrder` state, localStorage hydration/persistence, drag handle rendering, and table integration.
- Create: `src/web/client/column-order.ts`
  Pure helpers for default ids, storage parsing, reconciliation, and move operations.
- Modify: `tests/web/offers-app.test.ts`
  Add DOM-level tests for restore, fallback, persistence, reorder, and regressions after reorder.

### Task 1: Add pure column-order helpers with TDD

**Files:**
- Create: `src/web/client/column-order.ts`
- Modify: `tests/web/offers-app.test.ts`
- Test: `tests/web/offers-app.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Add this block near the top of `tests/web/offers-app.test.ts` after the `offersWithThreeStatuses` fixture:

```ts
describe("column order helpers", () => {
  it("reconciles saved ids with the current columns", async () => {
    const { reconcileColumnOrder } = await import("../../src/web/client/column-order");

    expect(reconcileColumnOrder(["firma", "priorytet"], ["stanowisko", "firma", "priorytet"])).toEqual([
      "firma",
      "priorytet",
      "stanowisko"
    ]);
  });

  it("drops unknown saved ids and keeps current order fallback", async () => {
    const { reconcileColumnOrder } = await import("../../src/web/client/column-order");

    expect(reconcileColumnOrder(["unknown", "firma"], ["stanowisko", "firma", "priorytet"])).toEqual([
      "firma",
      "stanowisko",
      "priorytet"
    ]);
  });

  it("moves a column before the target column", async () => {
    const { moveColumnOrder } = await import("../../src/web/client/column-order");

    expect(moveColumnOrder(["stanowisko", "firma", "priorytet"], "priorytet", "firma")).toEqual([
      "stanowisko",
      "priorytet",
      "firma"
    ]);
  });
});
```

- [ ] **Step 2: Run the helper tests to verify they fail**

Run: `npm test -- tests/web/offers-app.test.ts`

Expected: FAIL with a module resolution error for `../../src/web/client/column-order` or missing exported functions.

- [ ] **Step 3: Write the minimal helper implementation**

Create `src/web/client/column-order.ts` with:

```ts
export const OFFERS_TABLE_COLUMN_ORDER_STORAGE_KEY = "offers-table-column-order";

export function reconcileColumnOrder(savedIds: string[], currentIds: string[]) {
  const currentSet = new Set(currentIds);
  const knownSaved = savedIds.filter((id) => currentSet.has(id));
  const missingCurrent = currentIds.filter((id) => !knownSaved.includes(id));
  return [...knownSaved, ...missingCurrent];
}

export function moveColumnOrder(order: string[], sourceId: string, targetId: string) {
  if (sourceId === targetId) return order;

  const next = order.filter((id) => id !== sourceId);
  const targetIndex = next.indexOf(targetId);
  if (targetIndex === -1) return order;

  next.splice(targetIndex, 0, sourceId);
  return next;
}

export function parseStoredColumnOrder(rawValue: string | null, currentIds: string[]) {
  if (!rawValue) return currentIds;

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
      return currentIds;
    }

    return reconcileColumnOrder(parsed, currentIds);
  } catch {
    return currentIds;
  }
}
```

- [ ] **Step 4: Run the helper tests to verify they pass**

Run: `npm test -- tests/web/offers-app.test.ts`

Expected: PASS for the new helper tests, with the rest of the file still green.

- [ ] **Step 5: Commit the helper slice**

```bash
git add tests/web/offers-app.test.ts src/web/client/column-order.ts
git commit -m "feat: add column order helpers"
```

### Task 2: Restore and persist column order in the offers table

**Files:**
- Modify: `src/web/client/offers-app.tsx`
- Modify: `tests/web/offers-app.test.ts`
- Test: `tests/web/offers-app.test.ts`

- [ ] **Step 1: Write the failing UI tests for restore and invalid storage fallback**

Add these tests to `tests/web/offers-app.test.ts` inside `describe("offers app", ...)`:

```ts
  it("restores the saved column order from localStorage", async () => {
    window.localStorage.setItem("offers-table-column-order", JSON.stringify(["firma", "stanowisko", "dataDodania"]));

    document.body.innerHTML = `
      <div id="offers-app"></div>
      <script id="initial-offers" type="application/json">${JSON.stringify(offers)}</script>
    `;

    await import("../../src/web/client/offers-app");

    expect(
      await screen.findAllByRole("columnheader").then((headers) =>
        headers.slice(0, 3).map((header) => header.textContent?.trim())
      )
    ).toEqual(["Firma", "Stanowisko", "Data dodania"]);
  });

  it("falls back to the default order when stored column order is invalid", async () => {
    window.localStorage.setItem("offers-table-column-order", "{invalid-json");

    document.body.innerHTML = `
      <div id="offers-app"></div>
      <script id="initial-offers" type="application/json">${JSON.stringify(offers)}</script>
    `;

    await import("../../src/web/client/offers-app");

    expect(
      await screen.findAllByRole("columnheader").then((headers) =>
        headers.slice(0, 3).map((header) => header.textContent?.trim())
      )
    ).toEqual(["Stanowisko", "Status aplikacji", "Data dodania"]);
  });
```

- [ ] **Step 2: Run the UI tests to verify they fail**

Run: `npm test -- tests/web/offers-app.test.ts`

Expected: FAIL because the app ignores the saved order and always renders the default sequence.

- [ ] **Step 3: Implement controlled column order state and persistence**

Update `src/web/client/offers-app.tsx`:

1. Import the helper module:

```ts
import {
  OFFERS_TABLE_COLUMN_ORDER_STORAGE_KEY,
  parseStoredColumnOrder
} from "./column-order";
```

2. Derive stable column ids after the `columns` array:

```ts
  const defaultColumnOrder = columns.map((column) => String(column.accessorKey));
```

3. Add state near the other table state hooks:

```ts
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    if (typeof window === "undefined") return defaultColumnOrder;
    return parseStoredColumnOrder(
      window.localStorage.getItem(OFFERS_TABLE_COLUMN_ORDER_STORAGE_KEY),
      defaultColumnOrder
    );
  });
```

4. Persist changes:

```ts
  useEffect(() => {
    window.localStorage.setItem(OFFERS_TABLE_COLUMN_ORDER_STORAGE_KEY, JSON.stringify(columnOrder));
  }, [columnOrder]);
```

5. Pass the state into TanStack:

```ts
  const table = useReactTable({
    data: offers,
    columns,
    state: { sorting, columnVisibility, columnFilters, columnOrder },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onColumnOrderChange: setColumnOrder,
```

- [ ] **Step 4: Run the UI tests to verify they pass**

Run: `npm test -- tests/web/offers-app.test.ts`

Expected: PASS for restore and invalid-storage fallback tests.

- [ ] **Step 5: Commit the persistence slice**

```bash
git add tests/web/offers-app.test.ts src/web/client/offers-app.tsx
git commit -m "feat: restore persisted offers column order"
```

### Task 3: Add header drag and drop behavior with persistence regression coverage

**Files:**
- Modify: `src/web/client/offers-app.tsx`
- Modify: `tests/web/offers-app.test.ts`
- Test: `tests/web/offers-app.test.ts`

- [ ] **Step 1: Write the failing reorder interaction and persistence tests**

Add these tests to `tests/web/offers-app.test.ts` inside `describe("offers app", ...)`:

```ts
  it("reorders columns by dragging a header handle and persists the new order", async () => {
    document.body.innerHTML = `
      <div id="offers-app"></div>
      <script id="initial-offers" type="application/json">${JSON.stringify(offers)}</script>
    `;

    await import("../../src/web/client/offers-app");

    const firmaHandle = await screen.findByRole("button", { name: "Przeciągnij kolumnę Firma" });
    const stanowiskoHandle = await screen.findByRole("button", { name: "Przeciągnij kolumnę Stanowisko" });

    fireEvent.dragStart(firmaHandle, {
      dataTransfer: {
        setData: vi.fn(),
        getData: vi.fn(() => "firma"),
        effectAllowed: ""
      }
    });
    fireEvent.dragOver(stanowiskoHandle, { preventDefault: vi.fn() });
    fireEvent.drop(stanowiskoHandle, {
      dataTransfer: {
        getData: vi.fn(() => "firma")
      }
    });

    expect(
      await screen.findAllByRole("columnheader").then((headers) =>
        headers.slice(0, 3).map((header) => header.textContent?.trim())
      )
    ).toEqual(["Firma", "Stanowisko", "Status aplikacji"]);

    expect(JSON.parse(window.localStorage.getItem("offers-table-column-order") ?? "[]").slice(0, 3)).toEqual([
      "firma",
      "stanowisko",
      "statusAplikacji"
    ]);
  });

  it("keeps inline editing and filtering working after reordering a column", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true })
    });
    vi.stubGlobal("fetch", fetchMock);

    document.body.innerHTML = `
      <div id="offers-app"></div>
      <script id="initial-offers" type="application/json">${JSON.stringify(offers)}</script>
    `;

    await import("../../src/web/client/offers-app");

    const firmaHandle = await screen.findByRole("button", { name: "Przeciągnij kolumnę Firma" });
    const stanowiskoHandle = await screen.findByRole("button", { name: "Przeciągnij kolumnę Stanowisko" });

    fireEvent.dragStart(firmaHandle, {
      dataTransfer: {
        setData: vi.fn(),
        getData: vi.fn(() => "firma"),
        effectAllowed: ""
      }
    });
    fireEvent.dragOver(stanowiskoHandle, { preventDefault: vi.fn() });
    fireEvent.drop(stanowiskoHandle, {
      dataTransfer: {
        getData: vi.fn(() => "firma")
      }
    });

    fireEvent.change(await screen.findByLabelText("Filtr Firma"), {
      target: { value: "Acme" }
    });
    fireEvent.change(await screen.findByLabelText("Status aplikacji dla AI Engineer"), {
      target: { value: "CV wysłane" }
    });

    expect(screen.getByText("1 / 2 ofert")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/offers/1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status_aplikacji: "CV wysłane" })
    });
  });
```

- [ ] **Step 2: Run the interaction tests to verify they fail**

Run: `npm test -- tests/web/offers-app.test.ts`

Expected: FAIL because the drag handles do not exist yet and no drop logic updates the rendered order.

- [ ] **Step 3: Implement drag handles and reorder wiring**

Update `src/web/client/offers-app.tsx`:

1. Import `useEffect` and the move helper:

```ts
import { useEffect, useState } from "react";
import {
  OFFERS_TABLE_COLUMN_ORDER_STORAGE_KEY,
  moveColumnOrder,
  parseStoredColumnOrder
} from "./column-order";
```

2. Add DnD state:

```ts
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
```

3. Add helpers inside `OfferTableApp`:

```ts
  const handleColumnDragStart = (columnId: string) => (event: React.DragEvent<HTMLButtonElement>) => {
    setDraggedColumnId(columnId);
    event.dataTransfer.setData("text/plain", columnId);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleColumnDrop = (targetColumnId: string) => (event: React.DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const sourceColumnId = event.dataTransfer.getData("text/plain") || draggedColumnId;
    if (!sourceColumnId) return;
    setColumnOrder((current) => moveColumnOrder(current, sourceColumnId, targetColumnId));
    setDraggedColumnId(null);
  };
```

4. Replace the header content button block with sort button plus drag handle:

```tsx
<div className="header-cell">
  <button className="sort-button" onClick={header.column.getToggleSortingHandler()} type="button">
    {flexRender(header.column.columnDef.header, header.getContext())}
    {header.column.getIsSorted() === "asc" ? " ↑" : header.column.getIsSorted() === "desc" ? " ↓" : ""}
  </button>
  <button
    aria-label={`Przeciągnij kolumnę ${getColumnLabel(header.column)}`}
    draggable
    onDragOver={(event) => event.preventDefault()}
    onDragStart={handleColumnDragStart(header.column.id)}
    onDrop={handleColumnDrop(header.column.id)}
    type="button"
  >
    ↕
  </button>
</div>
```

- [ ] **Step 4: Run the full offers-app test file to verify it passes**

Run: `npm test -- tests/web/offers-app.test.ts`

Expected: PASS for the new reorder tests and the pre-existing filtering, visibility, autosave, and refresh tests.

- [ ] **Step 5: Commit the feature slice**

```bash
git add tests/web/offers-app.test.ts src/web/client/offers-app.tsx src/web/client/column-order.ts
git commit -m "feat: add drag and drop offers column reordering"
```

### Task 4: Run final verification for the changed surface

**Files:**
- Modify: none
- Test: `tests/web/offers-app.test.ts`

- [ ] **Step 1: Run the focused web UI test file**

Run: `npm test -- tests/web/offers-app.test.ts`

Expected: PASS with all offers app tests green.

- [ ] **Step 2: Run the broader web-related regression suite**

Run: `npm test -- tests/web/views.test.ts tests/web/offers-routes.test.ts tests/web/offer-view-model.test.ts`

Expected: PASS to confirm no view-model or route regressions.

- [ ] **Step 3: Run the project build**

Run: `npm run build`

Expected: TypeScript build completes successfully with no type errors.

- [ ] **Step 4: Review the diff before handoff**

Run:

```bash
git status --short
git diff -- src/web/client/offers-app.tsx src/web/client/column-order.ts tests/web/offers-app.test.ts
```

Expected: only the planned files changed, and the diff matches the approved scope.

- [ ] **Step 5: Commit the final verification state if needed**

```bash
git add src/web/client/offers-app.tsx src/web/client/column-order.ts tests/web/offers-app.test.ts
git commit -m "test: verify offers column reordering flow"
```
