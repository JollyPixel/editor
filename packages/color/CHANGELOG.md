# @jolly-pixel/color

## 1.1.1

### Patch Changes

- [#789](https://github.com/JollyPixel/editor/pull/789) [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285) Thanks [@fraxken](https://github.com/fraxken)! - Subpaths follow one naming scheme: `network/node` (now with the Vite plugin), `asset-server/{client,node}`, `asset-source/node`, `event-store/node` (was `./sqlite`), `image/browser` and `voxel.renderer/engine` (the Rapier plugin joins the root). `.ts` keys, wildcards, `network/parser` and `network/transport/*` are removed; transports ship from the network root, `./client` and `./node`.
  The `asset-server` and `asset-source` roots are now browser-safe and absorb `./backend`, `./kinds`, `./core` and `./indexeddb`; Node-only code moves to `./node`.
  Every published package declares `exports` instead of `main`/`types`, and the packages with no import-time side effects declare `"sideEffects": false`.

## 1.1.0

### Minor Changes

- [#668](https://github.com/JollyPixel/editor/pull/668) [`ab65462`](https://github.com/JollyPixel/editor/commit/ab65462597390541cdb2bee98a7aa22dff562c69) Thanks [@fraxken](https://github.com/fraxken)! - Add `layout="wide"` to `jolly-color-picker`: a height-filling row with vertical hue and alpha tracks and editable R/G/B, H/S/L, A and hex fields.
  Add `hsvToHsl()` and `hslToHsv()` to `@jolly-pixel/color`, keeping hue on grays and saturation through black.
