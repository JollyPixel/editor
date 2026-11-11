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
- Build e2e suites on `@jolly-pixel/e2e` (`packages/e2e/AGENTS.md`); keep only
  domain helpers in the suite.
- After changing a workspace, rebuild it with `pnpm run build` before
  validating consuming workspaces so they load the updated `dist/` output.
  After switching branches, or when a consumer fails on a missing export,
  rebuild every dependency with `pnpm --filter "<package>^..." run build`.
- Run the relevant package tests, `pnpm run typecheck`, and `pnpm run lint`.
  Set `NODE_OPTIONS=--test-reporter=dot` for unit runs: it prints only
  failures, about a twentieth of the default output.
- Search with `git grep` or the Grep tool; both skip `node_modules/` and
  `dist/`, which a plain `grep -r` floods with matches.
- After changing Markdown under `packages/**`, run `pnpm run docs:build`; it
  fails on dead links, including links to a folder instead of a page.

## Package routing

- Before changing a workspace, read its `GLOSSARY.md` and `ARCHITECTURE.md`
  when present. Use the glossary's terms and update it when adding a domain
  concept.
- These workspaces have an `AGENTS.md`; read it before changing them:
  `packages/asset-server`, `packages/cdp`, `packages/e2e`,
  `packages/pixel-draw-renderer`, `packages/server`, `packages/studio`,
  `packages/three`,
  `packages/ui`,
  `packages/voxel-renderer`, `packages/editors/host`,
  `packages/editors/scene`, `packages/editors/voxel-map`.

## Windows

- Rename a file's case only with `git mv -f`: the filesystem ignores case, so
  a plain rename passes locally and fails on Linux CI. Writing `Foo.ts` next to
  `foo.ts` overwrites it.
- To force a clean build, delete `tsconfig.tsbuildinfo` along with `dist/`, or
  `tsc -b` emits nothing.
- Put a `git worktree` at a short path such as `D:/jpb`: deeper paths exceed
  the Windows path limit during `pnpm install`.
