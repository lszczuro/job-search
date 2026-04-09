# Inline Offer Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add inline offer editing for selected fields directly in the offers table, persist changes through `PATCH /offers/:id`, and show visible save feedback.

**Architecture:** Extend the existing React table to keep editable row state and save through the already-existing Fastify PATCH route. Reuse the runtime SQLite update path and verify behavior with UI tests plus a persistence integration test.

**Tech Stack:** TypeScript, React 19, TanStack Table, Fastify, SQLite, Vitest, Testing Library

---

### Task 1: Lock Behavior With Tests

**Files:**
- Modify: `tests/web/offers-app.test.ts`
- Modify: `tests/web/offers-routes.test.ts`

- [ ] Add a failing UI test for editing and saving offer fields inline.
- [ ] Add a failing UI test for visible error feedback on failed save.
- [ ] Add a failing route/runtime persistence test that patches an offer and verifies the changed value is returned from SQLite.
- [ ] Run the targeted tests and confirm they fail for the expected reasons.

### Task 2: Implement Inline Editing

**Files:**
- Modify: `src/web/client/offers-app.tsx`
- Modify: `src/web/routes/offers-routes.ts`
- Modify: `src/app/runtime.ts`

- [ ] Add editable controls and row-level save state to the offers table.
- [ ] Submit changed editable fields to `PATCH /offers/:id`.
- [ ] Update local table state on success and show inline success or error feedback.
- [ ] Keep PATCH response semantics explicit enough for the client to detect failure.
- [ ] Run targeted tests and confirm they pass.

### Task 3: Document And Record Artifacts

**Files:**
- Modify: `README.md`
- Add: `tasks/tasks.yaml`
- Add: `logs/events.jsonl`
- Add: `tasks/review-inline-offer-editing.md`
- Add: `tasks/security-inline-offer-editing.md`

- [ ] Document which fields are editable inline from the offers UI.
- [ ] Record task status and artifact references in `tasks/tasks.yaml`.
- [ ] Append an event entry in `logs/events.jsonl`.
- [ ] Write concise review notes and a security report for this task.
- [ ] Run focused verification and then the full relevant test/build commands.
