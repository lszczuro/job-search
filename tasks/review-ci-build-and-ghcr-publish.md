# Review Notes: CI Build And GHCR Publish

- workflow trigger shape matches the approved design
- latest is limited to `main`
- semver tags come only from git tags matching `vX.Y.Z`
- merge remains blocked by the existing high-severity dependency finding reported during local dependency installation
