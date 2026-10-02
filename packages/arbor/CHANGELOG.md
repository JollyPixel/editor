# @jolly-pixel/arbor

## 1.1.1

### Patch Changes

- [#789](https://github.com/JollyPixel/editor/pull/789) [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285) Thanks [@fraxken](https://github.com/fraxken)! - Subpaths follow one naming scheme: `network/node` (now with the Vite plugin), `asset-server/{client,node}`, `asset-source/node`, `event-store/node` (was `./sqlite`), `image/browser` and `voxel.renderer/engine` (the Rapier plugin joins the root). `.ts` keys, wildcards, `network/parser` and `network/transport/*` are removed; transports ship from the network root, `./client` and `./node`.
  The `asset-server` and `asset-source` roots are now browser-safe and absorb `./backend`, `./kinds`, `./core` and `./indexeddb`; Node-only code moves to `./node`.
  Every published package declares `exports` instead of `main`/`types`, and the packages with no import-time side effects declare `"sideEffects": false`.

## 1.1.0

### Minor Changes

- [#488](https://github.com/JollyPixel/editor/pull/488) [`84c397e`](https://github.com/JollyPixel/editor/commit/84c397efa20a1749f8296f110bf019f7286a894c) Thanks [@fraxken](https://github.com/fraxken)! - Rename fs-tree to arbor

## 1.0.1

### Patch Changes

- [#291](https://github.com/JollyPixel/editor/pull/291) [`0d913de`](https://github.com/JollyPixel/editor/commit/0d913de782055a6636b441a66f9c59461f343b3c) Thanks [@fraxken](https://github.com/fraxken)! - Use private # symbol instead of TypeScript only private reserved keyword
