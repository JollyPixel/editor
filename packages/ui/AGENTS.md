# AGENTS.md

## Consumers

- Editors and the studio import `@jolly-pixel/ui` from `dist/`. After changing
  `src/`, run `pnpm run build` here before checking an editor. The gallery
  (`pnpm run dev`, gallery e2e) runs on `src/` and needs no rebuild.
- Before removing a subpath export, run the unit tests of every consuming
  workspace, not only typecheck and builds. `./stats` keeps the runtime startup
  path off the root entry, which registers every element.

## Gotchas

- `node:test` cannot import a `@customElement` class: type stripping rejects
  decorators. Put logic in a controller or model and unit-test that; cover the
  element wiring in an e2e.
- A `var()` nested in a custom property resolves on the element that declares
  the property. Never derive a token on an ancestor from an input set on a
  descendant.
- A parent's plain tag-name rule beats a child element's `:host { display }`.
  From outside, override only sizing and position (`flex`, `width`, `margin`).
- Overlays scale from 0.96 to 1 while opening. Place them from layout values
  (`offsetLeft`, `offsetWidth`), not client rects. In Playwright, wait for
  `getAnimations()` to finish before reading an overlay's `boundingBox()`.
- `page.addInitScript` runs again on `page.reload()`. Never clear storage in it
  in a persistence test.
- Vite HMR reloads the page when a source file changes, so a Playwright run
  fails at random while files are being edited. Rerun before debugging.
