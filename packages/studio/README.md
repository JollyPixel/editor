# @jolly-pixel/studio

One dev app that opens a JollyPixel project: one asset back-end for every
editor, a tree of the project's assets, and one editor page per tab.

If the catalog does not respond, Studio offers Retry or an offline workspace
stored in this browser. Add `?offline` to start there directly. The editor
frames share that workspace through BroadcastChannel.

Decisions in the [ADRs](./docs/adr/README.md), open work in
[ROADMAP.md](./ROADMAP.md), structure in
[ARCHITECTURE.md](./ARCHITECTURE.md), vocabulary in
[GLOSSARY.md](./GLOSSARY.md).

## Run

```bash
pnpm -r build
pnpm --filter @jolly-pixel/studio dev
```

The studio `build` script builds the pixel-art editor page
(`build:page`), which the pixel-art library build leaves out.

For static hosting, run
`pnpm --filter @jolly-pixel/studio build:static` and serve `dist/` at the
site root or under any sub-path. The build includes the three editor pages
and starts offline without an asset server.

The back-end root is `packages/studio/project/`, created and seeded on first
boot. Point `JOLLY_PROJECT` at another directory, absolute or relative to
this package, to open a real project. The seed only writes paths the root
lacks.

Seeded asset ids: `map-overworld`, `tileset-overworld`, `model-default`,
`model-texture`.

## Shell

The page prompts for a username once, then lists the catalog in a tree.
Activating a row (double-click or Enter) opens its editor in a tab, or
focuses the tab if it is already open. Rows whose kind has no editor page say
`no editor`. Four editor tabs at most: a fifth asks which one to close.
Open tabs come back after a reload, in their order; only the active one
loads its editor until another is focused.

Ctrl+click or Shift+click selects several rows of one folder, to move or
delete them together. New folder adds an empty folder that exists until a
reload or until an asset lands in it. An asset referenced by a same-named
asset in its folder is its companion: it nests under it and follows its
renames and moves, see
[ADR-0013](./docs/adr/0013-companions-are-derived-from-names-and-edges.md).

Each tab is an iframe on `/editors/<name>/`. The page posts `jolly-ready`,
the shell answers with `jolly-launch` and the target id, and the editor can
post `jolly-shell` commands back (`open-asset` today). Set
`jolly-pixel:debug` in `localStorage` (for example to `host.*,studio.tabs`)
to log the handshake and each editor's boot steps. An editor page can also be
opened directly:

```
http://localhost:5173/editors/voxel-map/?target=map-overworld
http://localhost:5173/editors/voxel-model/?target=model-default
http://localhost:5173/editors/pixel-art/?target=model-texture
```

Editor pages come from each editor package's built page folder (`dist/`,
`dist-page/` for pixel-art), and they bundle `@jolly-pixel/editor.host` and
`@jolly-pixel/ui`. To see editor, host or ui changes while the studio runs,
start the watch builds in a second terminal:

```bash
pnpm --filter @jolly-pixel/studio dev:editors
```

Each rebuilt page reloads its open tabs. Editor code has no HMR here.

## Layout

| Path | Role |
|---|---|
| `vite.config.ts`, `vite/` | back-end plugin, editor pages plugin, seed |
| `src/catalog/` | tree model from catalog records |
| `src/editors/` | `EditorRegistry`: kind icons and editor pages |
| `src/tabs/` | tab strip, iframe stack, launch handshake |
| `src/shell/` | wires the catalog, the tree and the tabs |

## Checks

```bash
pnpm --filter @jolly-pixel/studio test
pnpm --filter @jolly-pixel/studio lint
```
