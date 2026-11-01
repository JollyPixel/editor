# AGENTS.md

## Boundaries

Never import `@jolly-pixel/ui` or an editor, even transitively: `@jolly-pixel/ui`
devDepends on this package. Locators match `jolly-*` tags and ARIA roles;
`nextFrames` types `window.jollyEditor` structurally.

## New suite

1. Add a port to `PORTS` and pass it to `RunMode` in the suite's `vite.config.ts`.
2. Add `playwright.config.ts` (`defineE2EConfig`) and a `test:e2e` script running
   `playwright test`.
3. Editors: `test/e2e/fixtures.ts` exports `editorFixture` with the seed documents,
   and `expect`. Specs go in `test/e2e/<feature>.e2e.ts`.
4. Serve with `vite --mode e2e` and add `mode.plugins()`. Without
   `prebundleWorkspace()`, every linked `dist/` file is its own request and CI
   boots time out. A page importing its own `src/` needs
   `vite build --mode e2e && vite preview --mode e2e`, like `@jolly-pixel/ui`.
5. CI runs `test:e2e` when the package or a workspace dependency changes. Opt out
   with a `--skip-e2e` entry in `.github/workflows/node.js.yml`.
6. A scenario suite (one user story checked through exported archives) uses
   `defineScenarioConfig` and a `test:scenario` script instead; CI never runs it.

## Gotchas

- Tracing is off locally (it slowed voxel-map by about 30%); rerun a failure
  with `--trace=on`. CI traces only the retry, so races still show up on the
  first attempt.
- `nextFrames` counts runtime updates, not animation frames: with `maxFps` set,
  most animation frames render nothing.
- `pressAt` waits frames between pointer steps because editors sample input once
  per frame. Pass `target` when an element might cover the point: a raw press
  lands on whatever is on top silently, `target.hover()` fails and names it.
- `reloadEditor` listens for `load` before reloading. When the page reloads
  itself (Reset offline data), pass that click as `reload`.
- `editorFixture` grants `role` (`"member"` by default) to a per-test subject,
  so parallel tests never revoke each other. `access.become(role)` revokes the
  subject's connections, which reconnect with the new role; a page opened
  before any `grant()` is not reached. `peer` gets no grant.
- Locators filter by visible text: `jolly-dialog` has no accessible name and
  field labels are not tied to their inputs. `treeRow` matches the text node
  because a row's accessible name includes its action labels.
- `RunMode` keeps the asset server in memory in `--mode e2e` and every build,
  so tests never touch the project on disk.
