# Manual Offer Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual offer creation from the offers GUI through a modal form, persist the record into `job_offers`, and show the new row immediately in the table.

**Architecture:** Extend the existing offers page client with a modal create flow and add a `POST /offers` contract on top of the current Fastify runtime. Reuse the same `job_offers` table and offer list model as imported records, distinguishing manual entries with `source = manual` plus explicit server-side defaults.

**Tech Stack:** TypeScript, React 19, Fastify, better-sqlite3, Vitest, Testing Library

---

### Task 1: Lock The Create Contract With Tests

**Files:**
- Modify: `tests/web/offers-routes.test.ts`
- Modify: `tests/app/runtime.test.ts`

- [ ] Add a failing route test for `POST /offers` success with required fields only.
- [ ] Add a failing route test for duplicate `url` rejection.
- [ ] Add a failing route test for invalid payload rejection.
- [ ] Add a failing runtime test that proves a manual record is persisted with the agreed defaults and appears in `listOffers()`.
- [ ] Run: `npm test -- tests/web/offers-routes.test.ts tests/app/runtime.test.ts`
Expected: FAIL because `POST /offers` and manual create behavior do not exist yet.
- [ ] Commit:
```bash
git add tests/web/offers-routes.test.ts tests/app/runtime.test.ts
git commit -m "test: define manual offer entry backend contract"
```

### Task 2: Implement Manual Create In Runtime And Routes

**Files:**
- Modify: `src/app/runtime.ts`
- Modify: `src/web/routes/offers-routes.ts`
- Modify: `src/web/server.ts`

- [ ] Add minimal runtime support for creating a manual offer with:
  - required fields `stanowisko`, `firma`, `url`
  - defaults `status_aplikacji = 📋 Zapisana`, `priorytet = 🔥 Teraz`, `status_ogloszenia = 🟢 Aktywne`
  - defaults `lokalizacja = Brak danych`, `tryb_pracy = Nieznany`, `kontrakt = Nieznany`, `notatki = ""`
  - timestamps for `data_dodania`, `ostatnia_weryfikacja`, `created_at`, `updated_at`
  - `source = manual`, `source_external_id = null`
- [ ] Return explicit error codes for:
  - missing required fields
  - invalid URL
  - duplicate URL
- [ ] Register `POST /offers` alongside the existing list and patch routes.
- [ ] Keep the response payload explicit enough for the frontend to append the created row without reloading.
- [ ] Run: `npm test -- tests/web/offers-routes.test.ts tests/app/runtime.test.ts`
Expected: PASS
- [ ] Commit:
```bash
git add src/app/runtime.ts src/web/routes/offers-routes.ts src/web/server.ts tests/web/offers-routes.test.ts tests/app/runtime.test.ts
git commit -m "feat: add manual offer creation API"
```

### Task 3: Add Modal UI And Client-Side Create Flow

**Files:**
- Modify: `src/web/client/offers-app.tsx`
- Modify: `tests/web/offers-app.test.ts`

- [ ] Add a failing UI test for opening the manual-entry modal from the toolbar.
- [ ] Add a failing UI test for successful submit and immediate row appearance in the table.
- [ ] Add a failing UI test for inline error feedback when create fails.
- [ ] Run: `npm test -- tests/web/offers-app.test.ts`
Expected: FAIL because the modal UI and create flow do not exist yet.
- [ ] Add the `Dodaj ręcznie` toolbar action.
- [ ] Add a modal with required fields `stanowisko`, `firma`, `url`.
- [ ] Submit the form to `POST /offers`, disable submit while saving, preserve values on failure, and close on success.
- [ ] Append the created offer row into local offers state without a full page reload.
- [ ] Run: `npm test -- tests/web/offers-app.test.ts`
Expected: PASS
- [ ] Commit:
```bash
git add src/web/client/offers-app.tsx tests/web/offers-app.test.ts
git commit -m "feat: add manual offer entry modal"
```

### Task 4: Finish Repo Artifacts And Verification

**Files:**
- Modify: `README.md`
- Modify: `tasks/tasks.yaml`
- Modify: `logs/events.jsonl`
- Add: `tasks/test-report-manual-offer-entry.md`
- Add: `tasks/review-manual-offer-entry.md`
- Add: `tasks/security-manual-offer-entry.md`

- [ ] Update `README.md` to document manual record creation from the GUI.
- [ ] Append a completed `manual-offer-entry` task entry to `tasks/tasks.yaml` with links to spec, plan, reports, and target paths.
- [ ] Append an event entry to `logs/events.jsonl`.
- [ ] Write the test report, review notes, and security report required by `AGENTS.md`.
- [ ] Run: `npm test`
Expected: PASS
- [ ] Run: `npm run build`
Expected: PASS
- [ ] Commit:
```bash
git add README.md tasks/tasks.yaml logs/events.jsonl tasks/test-report-manual-offer-entry.md tasks/review-manual-offer-entry.md tasks/security-manual-offer-entry.md
git commit -m "docs: record manual offer entry completion artifacts"
```
