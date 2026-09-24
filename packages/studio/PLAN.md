# @jolly-pixel/studio — PLAN

Phases are sequential. Each ends with the listed checks green:
`pnpm --filter @jolly-pixel/studio test`, `pnpm run typecheck`, `pnpm run lint`.

## P1 — Package and back-end (done 2026-09-22)

- `packages/studio`: private package, `tsconfig.json` on the shared mixins,
  `vite.config.ts`, `index.html`, `src/index.ts`, `test/`.
- `createAssetWorkspacePlugin` over `JOLLY_PROJECT` or `project/` with the
  four handlers and the `vite/seed/` module. `project/` gitignored.
- `editorPagesPlugin` serving each editor `dist/` at `/editors/<name>/`.
  Editors gain `base: "./"`.
- Tests: the pages plugin resolves a dist path and serves `index.html` for a
  directory request, rejects a path escaping the dist, returns 404 for an
  unknown editor. Node test over the middleware, no browser.
- Exit: studio dev server boots, `/editors/voxel-map/?target=<seed id>` opens
  the editor against the studio back-end.

Found on the way: the built editor pages hung at boot because their entries
top-level-awaited the mount (SPEC, server side). Both entries now call the
mount without awaiting it. The pages plugin lives in `vite/editorPages.ts`
with the handler exported on its own for the tests.

## P2 — Shell (done 2026-09-22)

- Identity prompt, one `CatalogClient`, tree model from catalog records
  (path prefix folders, kind icons, stable node ids), editor registry.
- `jolly-tabs` plus iframe stack. Open on activate, focus existing tab, close
  removes the iframe. Tab cap from the SPEC.
- Ready/launch handshake: `HostMessageLaunchSource` posts `jolly-ready`;
  the shell answers. Timeout kept as fallback. Host docs updated.
- `ShellChannel` in `editor.host`: `context.shell`, non-null only after a
  parent answer, `openAsset(id)` posts `jolly-shell` `open-asset`. The shell
  routes it through the same open-tab path as a tree activation.
- Tests: tree model from a record list (folders, ordering, rename of a
  folder yields N renames), registry lookup, tab controller (open, focus,
  close, cap) with `happy-dom`. Host: launch source posts ready, resolves on
  the parent's answer, still times out without one; `context.shell` is null
  for a query launch and posts the command for a parent launch.
- Exit: open a map and a model in two tabs, switch, close, reopen.

Shipped as `src/catalog/assetTree.ts` (model, `folderRenames` ready for
P3), `src/editors/editorRegistry.ts`, `src/tabs/EditorTabs.ts` (strip,
frames, cap, handshake, shell commands) and `src/shell/StudioShell.ts`. The
host gained `ShellChannel`, `context.shell` and the ready post in
`HostMessageLaunchSource`; the `mountStandalone` doc and the architecture
guide describe both. Editor pages must be rebuilt after a host change.

## P3 — Catalog actions (done 2026-09-24)

- Inline rename, delete with dependents listed, drag to reparent as rename.
- Errors surface in a `jolly-log` or dialog, never in the console only.
- Tests: `AssetPath` and `AssetTreeModel` unit specs (rename targets,
  folder renames, drop targets, moves). The element flows (a rejected
  command restores the label, delete with dependents) move to P5's e2e.

Shipped as `src/catalog/AssetPath.ts` (value object: name, parent,
extension, rebase), `src/catalog/AssetTreeModel.ts` (replaces
`assetTree.ts`), `src/shell/Studio.ts` (`<jolly-studio>`: layout, tabs,
routing; `StudioShell` is gone) and `src/shell/assets/` (`<asset-browser>`,
`<asset-delete-dialog>`), on the editors' one-element-per-panel pattern. The
shell renders in light DOM so `main.css` still styles the layout.
`jolly-tree` gained `activateOnDoubleClick` and `beginRename(id)`, since a
renamable row otherwise renames on double-click instead of opening.

## P4 — Pixel-art page

- `PixelArtEditor` in `editors/pixel-art`: `index.html`, boot module, panel
  over the target document, presence, `Join pixel art` identity title.
  Generic demo boot pieces move to `src/` and the demo imports them there.
- Vite build to `dist-page/`, `base: "./"`, a `build:page` script the studio
  `build` depends on. Registry gains `pixelart`.
- voxel-map Paint tab: an action calling `context.shell.openAsset` for the
  selected tileset, hidden when `context.shell` is null.
- Tests: the editor mounts over a fake session with `happy-dom` and joins
  the target room; the Paint action is absent without a shell and posts the
  command with one.
- Exit: a texture row opens a pixel-art tab; the Paint tab opens the tileset
  in a second tab and focuses it on a repeat.

## P5 — E2E and docs

- Playwright on the voxel-map pattern: memory source and store in `e2e`
  mode, low fps cap, editor pages built once by the web server command, one
  spec: tree lists seeds, open a tab, the iframe's debug handle exists,
  close the tab. Built pages expose no debug handle (`import.meta.env.DEV`
  is false), so the spec checks the frame's DOM or the shell's own handle.
  A hidden tab never fires `requestAnimationFrame`, so the editor scene
  only awakes while the page is visible.
- `README.md`, `ARCHITECTURE.md`, `GLOSSARY.md`, docs site placement.
- Editor host `ROADMAP.md` updated: shell exists, the `EditorDefinition`
  revisit is now unblocked.

## Later, out of this plan

Identity in the launch message, authentication, `project.json`, settings
pane, new-asset factories, runtime tab, in-process mounting. Tracked in
`ROADMAP.md` once P5 lands.

Boot tracing for the host and runtime abstractions: `mountStandalone`, the
session open, `Runtime.create`, the bootstrap steps and the scene's ready
promise log nothing today, so a silent hang (P1's deadlock) is only found
with temporary `console.log` inserts and a rebuild. A debug logger the
editors and the studio can turn on belongs in `editor.host` and `runtime`.
Also in `editors/host/ROADMAP.md`.
