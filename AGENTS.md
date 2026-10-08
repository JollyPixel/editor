# Repository instructions

## Workflow

- Use pnpm exclusively. Never run npm or yarn.
- Use Git commands as needed, but do not create commits unless explicitly
  requested.
- When explicitly requested to commit, use `--no-gpg-sign` and do not add
  `Co-Authored-By`, AI attribution, or similar trailers.
- Before editing TypeScript or JavaScript under `packages/**`, read and follow
  `.github/CODE_STYLE.md`.
- Update Markdown API documentation when changing a public API.
- Before writing or editing source comments or Markdown documentation, load the
  `documentation-maintenance` skill.
- Keep release changeset summaries to two or three lines and never add changesets for workspace with private:true enabled in package.json.

## Validation

- Before writing, changing, or reviewing tests, load the `test-audit` skill.
- Add or update deterministic tests for behavior changes.
- Put tests under the package's `test/` directory.
- Use `happy-dom` when DOM mocking is needed.
- Use `tstyche` for testing types.
- E2E tests are slow to run. Add one only when a unit or `happy-dom` test
  cannot cover the behavior (real browser rendering, WebGL, cross-page or
  network flows), and tell the user that reason before adding it.
- Build e2e suites on `@jolly-pixel/e2e` (`packages/e2e/README.md`); keep only
  domain helpers in the suite.
- After changing a workspace, rebuild it with `pnpm run build` before
  validating consuming workspaces so they load the updated `dist/` output.
- Run the relevant package tests, `pnpm run typecheck`, and `pnpm run lint`.

## Package routing

- Before changing files in a workspace under `packages/**`, read that
  workspace's `AGENTS.md` if present.
