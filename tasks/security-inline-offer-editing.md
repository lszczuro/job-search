# Security Report: Inline Offer Editing

## Scope

Inline editing in the offers table for `status_aplikacji`, `priorytet`, `status_ogloszenia`, and `notatki`.

## Findings

- No new secret handling was introduced.
- The client still talks only to same-origin endpoints.
- The backend continues to whitelist editable fields before building SQL updates.
- SQL values remain parameterized; the patch does not introduce string interpolation for user-supplied values beyond field names already constrained by the allowlist.

## Notes

- `npm install` reported existing dependency vulnerabilities in the workspace (`4 moderate`, `1 high`). This change does not modify dependency versions.
