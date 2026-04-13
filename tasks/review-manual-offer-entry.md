# Review Notes: Manual Offer Entry

- Verified the existing offers table flow stays intact while adding a separate modal create entrypoint.
- Verified the create flow talks to the existing same-origin `POST /offers` API and appends the created row into local table state instead of reloading.
- Verified failure handling keeps the modal open and preserves entered values for correction or retry.
- No open review findings before final full verification.
