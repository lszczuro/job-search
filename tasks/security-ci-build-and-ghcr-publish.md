# Security Report: CI Build And GHCR Publish

- publishing uses `GITHUB_TOKEN`
- workflow permissions are limited to `contents: read` and `packages: write`
- no long-lived registry secret added to the repository
- local `npm install` reported 5 known vulnerabilities in the dependency tree, including 1 high severity finding; treat this as a merge blocker until reviewed separately
