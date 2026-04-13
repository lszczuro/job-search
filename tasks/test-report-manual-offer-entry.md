# Test Report: Manual Offer Entry

## Focused Regression

Command:

```bash
npm test -- tests/web/offers-app.test.ts
```

Result:

- passed
- `1` test file
- `15` tests
- UI regression coverage for opening and closing the modal, successful submit, and inline error handling

## Full Verification

Commands:

```bash
npm test
npm run build
```

Result:

- `npm test`: passed, `19` test files, `55` tests
- `npm run build`: passed
