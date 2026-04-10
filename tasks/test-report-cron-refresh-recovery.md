# Test Report: cron-refresh-recovery

- `npm test -- tests/db/import-jobs-repository.test.ts`
  - Result: passed
  - Coverage in scope: verified regression for an orphaned `running` refresh job and existing reuse behavior for active jobs.
- `npm test`
  - Result: passed
  - Summary: 19 test files passed, 45 tests passed.
- `npm run build`
  - Result: passed
