# @jolly-pixel/studio — PLAN

Each phase ends with `pnpm --filter @jolly-pixel/studio test`,
`pnpm run typecheck` and `pnpm run lint` green.

## Done

- P1 (2026-09-22): package, asset workspace back-end, editor pages served at
  `/editors/<name>/`.
- P2 (2026-09-22): shell, asset tree, editor tabs, ready/launch handshake,
  `ShellChannel` in `editor.host`.
- P3 (2026-09-24): rename, delete with dependents, drag to reparent.
- Shell design (2026-09-24): header, Home tab, kind filter, Export, tab
  reorder, dock handle fix.
- D1 (2026-09-24): data-only registry. Kinds come from
  `AssetKindDescriptor`, editors from the `jollypixel.editor` manifest.
- P5, partly: Playwright suites (`shell.e2e.ts`, `offline.e2e.ts`) and the
  editor host `ROADMAP.md` update.

## Open issues

- Editor pages bundle their own `ui` and `editor.host`: a change to either
  reaches an editor only once its page is rebuilt.
- Tab order is not persisted.
- `pixelArtAssetKind` still takes the tileset size as `defaultSize`, because
  `PixelArtState.clear()` resets to it. Separating the new-texture size from
  the seed needs a decision on what `clear` should restore.
- Static pages use the absolute `/editors/` prefix while the build sets
  `base: "./"`, so a build hosted under a sub-path cannot load its editors.

## P4 — Pixel-art page

- `PixelArtEditor` in `editors/pixel-art`: `index.html`, boot module, panel
  over the target document, presence, `Join pixel art` identity title.
  Generic demo boot pieces move to `src/` and the demo imports them there.
- Vite build to `dist-page/`, `base: "./"`, a `build:page` script the studio
  `build` depends on. The package declares a `jollypixel.editor` manifest
  (`pixel-art`, kinds `pixelart`, dist `dist-page`) and the studio
  `vite.config.ts` lists it; nothing else changes in the shell.
- voxel-map Paint tab: an action calling `context.shell.openAsset` for the
  selected tileset, hidden when `context.shell` is null.
- Tests: the editor mounts over a fake session with `happy-dom` and joins
  the target room; the Paint action is absent without a shell and posts the
  command with one.
- Exit: a texture row opens a pixel-art tab; the Paint tab opens the tileset
  in a second tab and focuses it on a repeat.

## P5 — Docs

- `ARCHITECTURE.md`, `GLOSSARY.md`, docs site placement.

## Dynamic kinds and editors

The goal is kinds and editors loaded from outside the monorepo (a project
folder, a package in `node_modules`). The rule: the shell consumes data only.
Kind code stays in handlers on the back-end, editor code stays in iframes.

### D2 — New asset from the shell

- Catalog `create` accepts a path and a kind without content; the back-end
  writes the handler's `serialize(create(id))`, as seeding does. Protocol
  schema, `CatalogClient.create` and asset-server docs updated.
- `<asset-browser>` gains a New action per registered kind, labelled and
  iconed from the descriptor, named with the kind's extension. The
  extension joins `AssetKindDescriptor` so the shell never reads a handler.
- Tests: asset-server creates a contentless asset of each built-in kind and
  rejects an unknown kind; the browser action sends the command.
- Exit: create a map, a model and a texture from the tree and open each.

### D3 — `project.json`

- `project/.jollypixel/project.json` lists the editor packages and the kind
  packages. The Vite config reads it instead of hard-coded lists; the
  handler list comes from the kind packages (one factory export per package,
  taking the project's options).
- The editors' own Vite configs and offline workspaces keep their private
  lists until they open a project the same way.
- Tests: a project file resolves editors and kinds; a missing package or a
  kind claimed twice fails with the package named.

### D4 — External sources

- Resolve packages from the project folder's `node_modules`, not only the
  studio's, and descriptors or editors from a local folder.
- Replace the `virtual:jolly-pixel/editors` build-time module with a served
  manifest (`/editors.json` plus descriptors), so adding an editor needs no
  studio rebuild. The registry and the manifest shapes stay the same.
- Settle trust: an external editor runs same-origin in an iframe today.

## Later, out of this plan

Identity in the launch message, authentication, settings pane, runtime tab,
in-process mounting (see `editors/host/ROADMAP.md`).

Boot tracing: `mountStandalone`, the session open, `Runtime.create`, the
bootstrap steps and the scene's ready promise should log through the host
logger, so a silent boot hang no longer needs temporary `console.log` calls.
