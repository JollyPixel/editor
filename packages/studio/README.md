# @jolly-pixel/studio

One dev app that opens a JollyPixel project: one asset back-end for every
editor, a tree of the project's assets, and one editor page per tab.

If the catalog does not respond, Studio offers Retry or an offline workspace
stored in this browser. Add `?offline` to start there directly. The map and
model editor frames share that workspace through BroadcastChannel.

Design in `SPEC.md`, phases in `PLAN.md`.

## Run

```bash
pnpm -r build
pnpm --filter @jolly-pixel/studio dev
```

For static hosting, run
`pnpm --filter @jolly-pixel/studio build:static` and serve `dist/` at the
site root. The build includes both editor pages and starts offline without
an asset server.

The back-end root is `packages/studio/project/`, created and seeded on first
boot. Point `JOLLY_PROJECT` at another directory, absolute or relative to
this package, to open a real project. The seed only writes paths the root
lacks.

Seeded asset ids: `map-overworld`, `tileset-default`, `model-default`,
`model-texture`.

## Shell

The page prompts for a username once, then lists the catalog in a tree.
Activating a row (double-click or Enter) opens its editor in a tab, or
focuses the tab if it is already open. Rows whose kind has no editor page say
`no editor`. Four editor tabs at most: a fifth asks which one to close.

Each tab is an iframe on `/editors/<name>/`. The page posts `jolly-ready`,
the shell answers with `jolly-launch` and the target id, and the editor can
post `jolly-shell` commands back (`open-asset` today). An editor page can
also be opened directly:

```
http://localhost:5173/editors/voxel-map/?target=map-overworld
http://localhost:5173/editors/voxel-model/?target=model-default
```

Editor pages come from each editor package's `dist/`, so rebuild an editor
after changing it, or after changing `@jolly-pixel/editor.host`, which the
pages bundle. Editor code has no HMR here.

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
