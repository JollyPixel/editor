# @jolly-pixel/image

## 2.0.0

### Major Changes

- [#789](https://github.com/JollyPixel/editor/pull/789) [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285) Thanks [@fraxken](https://github.com/fraxken)! - Subpaths follow one naming scheme: `network/node` (now with the Vite plugin), `asset-server/{client,node}`, `asset-source/node`, `event-store/node` (was `./sqlite`), `image/browser` and `voxel.renderer/engine` (the Rapier plugin joins the root). `.ts` keys, wildcards, `network/parser` and `network/transport/*` are removed; transports ship from the network root, `./client` and `./node`.
  The `asset-server` and `asset-source` roots are now browser-safe and absorb `./backend`, `./kinds`, `./core` and `./indexeddb`; Node-only code moves to `./node`.
  Every published package declares `exports` instead of `main`/`types`, and the packages with no import-time side effects declare `"sideEffects": false`.

## 1.1.0

### Minor Changes

- [#564](https://github.com/JollyPixel/editor/pull/564) [`1541725`](https://github.com/JollyPixel/editor/commit/1541725c977cc4b74cf05045c2674585150a1383) Thanks [@fraxken](https://github.com/fraxken)! - Initial release. A DOM-free `decodePng` / `encodePng` pair speaking flat RGBA8,
  plus a `raster` entry whose decoder ladder prefers exact paths over a
  premultiplying canvas. Extracted from `@jolly-pixel/pixel-draw.renderer`.
