# CI Build And GHCR Publish Design

## Goal

Build the project on GitHub Actions and publish the application container to `ghcr.io`, with `latest` representing the current `main` branch and semantic version tags coming only from git release tags.

## Scope

This design covers:

- GitHub Actions workflow execution on pushes to `main`
- GitHub Actions workflow execution on git tags matching `vX.Y.Z`
- project validation before publishing
- container image publication to `ghcr.io`
- Docker image tagging rules for `latest` and semver releases
- repository documentation for the release flow

This design does not add automatic version bumping, release note generation, or deployment beyond publishing the image to the container registry.

## Current State

- the repository contains a working `Dockerfile`
- the project can be built locally with `npm run build`
- there is no `.github/workflows/` configuration in the repository
- there is no documented release flow for container publication
- `package.json` contains a version, but that version is not a safe source of immutable container release tags

## Design Summary

The repository will use GitHub Actions as the single CI/CD entry point for container builds.

Two publication paths will exist inside one workflow:

1. A push to `main` runs validation, builds the image, and publishes `ghcr.io/<owner>/<repo>:latest`
2. A push of a git tag matching `vX.Y.Z` runs the same validation, builds the image, and publishes `ghcr.io/<owner>/<repo>:X.Y.Z`

This keeps branch state and release state separate:

- `latest` means "current state of `main`"
- `X.Y.Z` means "immutable release selected by a git tag"

## Architecture

### Workflow triggers

The workflow will run on:

- `push` to `main`
- `push` tags matching `v*.*.*`

Pull requests are out of scope for this change because the requested goal is build and publication, not broader CI coverage.

### Validation stage

Before publishing, the workflow will:

- install dependencies with `npm ci`
- run `npm test`
- run `npm run build`

If validation fails, the image is not published.

### Publish stage

After validation succeeds, the workflow will:

- set up Docker Buildx
- log in to `ghcr.io` using GitHub Actions credentials
- build from the repository `Dockerfile`
- publish the image to `ghcr.io`

The image name will use the standard GitHub repository path, normalized to lowercase for registry compatibility.

## Tagging Rules

### Main branch pushes

When the workflow runs from a push to `main`, it will publish exactly:

- `latest`

No semver tags are published from branch pushes.

### Release tag pushes

When the workflow runs from a git tag matching `vX.Y.Z`, it will publish exactly:

- `X.Y.Z`

The leading `v` is stripped before publishing the container tag.

This avoids ambiguous tags and prevents multiple different images from being pushed under the same semver tag due to ordinary branch activity.

## Authentication And Permissions

The workflow will rely on GitHub's built-in token with explicit permissions:

- `contents: read`
- `packages: write`

No long-lived registry secret is required for publishing to the repository owner's `ghcr.io` namespace when GitHub Actions package permissions are configured normally.

## Error Handling

- if dependency installation, tests, or build fail, the workflow stops before publishing
- if registry login fails, the workflow fails and no image is pushed
- if the tag format is invalid, the semver publish path does not run because only `v*.*.*` tags trigger it

## Documentation Changes

The repository documentation will describe:

- that GitHub Actions builds and publishes the image
- that `latest` is published from `main`
- that semver image tags come from git tags like `v0.2.0`
- what repository/package permissions are required on GitHub

## Testing Strategy

Verification for this change is workflow-oriented rather than application-code-oriented:

- local validation still uses `npm test`
- local validation still uses `npm run build`
- workflow YAML should be linted by structure review and command correctness
- documentation should reflect the exact tagging behavior so releases remain understandable

## Files Likely To Change

- `.github/workflows/*.yml`
- `README.md`

## Acceptance Criteria

- pushes to `main` build the project on GitHub Actions
- successful pushes to `main` publish `ghcr.io/<owner>/<repo>:latest`
- pushes of git tags matching `vX.Y.Z` build the project on GitHub Actions
- successful tag pushes publish `ghcr.io/<owner>/<repo>:X.Y.Z`
- publishing is blocked when tests or build fail
- repository documentation explains the release and tagging model
