# Repository instructions

## Workflow

- Use npm exclusively.
- Use Git commands as needed, but do not create commits unless explicitly
  requested.
- When explicitly requested to commit, use `--no-gpg-sign` and do not add
  `Co-Authored-By`, AI attribution, or similar trailers.
- Before editing TypeScript or JavaScript under `packages/**`, read and follow
  `.github/CODE_STYLE.md`.
- Update Markdown API documentation when changing a public API.
- Keep release changeset summaries to two or three lines.

## Validation

- Add or update deterministic tests for behavior changes.
- Put tests under the package's `test/` directory.
- Use `happy-dom` when DOM mocking is needed.
- Run the relevant package tests and `npm run lint`.

## Package routing

- Before changing files in a workspace under `packages/**`, read that
  workspace's `AGENTS.md` if present.
