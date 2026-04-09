# Test Report: Offers Table Column Filters

## Command

```bash
npm test -- tests/web/offers-app.test.ts
npm test
```

## Results

```
✓ tests/web/offers-app.test.ts (8 tests) 764ms
Test Files  16 passed (16)
Tests       30 passed (30)
```

## Coverage

| Test | Behavior |
|---|---|
| filters rows by location from the column filter controls | text filter on `lokalizacja` narrows rows |
| filters rows by exact date added | date filter on `dataDodania` matches exact day |
| filters rows by multiple selected status values | multi-select on `statusOgloszenia` with OR semantics |
| filters note labels from the notes column and clears active filters | note-select filter and global clear action |
| renders the exact table columns required by the issue | all 13 column headers present with clean textContent |
| lets the user hide a table column | column visibility toggle removes header and cells |
| saves inline edits immediately after changing a select value | autosave PATCH on field change |
| shows an inline error when autosaving an edited field fails | error feedback on failed save |

## Notes

All pre-existing tests continue to pass. No regressions.
