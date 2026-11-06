# AGENTS.md

## Stale builds

- The dev server and the e2e back-end load `@jolly-pixel/asset.voxel-map` from
  `dist/`. A stale build answers new command kinds with a correction and drops
  new document fields on reload. Rebuild `packages/assets/voxel-map` after
  changing commands or document shapes.
- `assets/` is gitignored and a seed only applies to a missing path. To change
  the seed, stop the dev server (it holds `.jollypixel/events.db` open) and
  delete `assets/`.

## Adding behavior

- A shortcut is an action in `MAP_KEY_BINDINGS` plus a handler in the owning
  feature's factory, spread in `EditorScene`. Nothing type-checks that every
  action has a handler.
- A Lit child never reads an injected property in its constructor, only from
  `connectedCallback` on.

## Testing

- The scenario opens the editor with `samples: "0"`: MSAA doubles headless run
  time. Keep it on new entry points.
- A Playwright test that fails only under parallel load is CPU starvation;
  rerun it alone with `--workers=1`. One that fails alone is usually a raw
  pointer press landing on another element: check `elementFromPoint`.
- Keyboard input is suspended while the pointer is over a panel. Hover the
  canvas before pressing Enter or Escape.
- Two tabs of one Chrome profile cannot both join the room. Use a second
  profile, or inject peer state from the page.
