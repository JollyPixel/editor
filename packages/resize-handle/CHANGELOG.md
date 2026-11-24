# @jolly-pixel/resize-handle

## 1.2.1

### Patch Changes

- [#789](https://github.com/JollyPixel/editor/pull/789) [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285) Thanks [@fraxken](https://github.com/fraxken)! - Package subpaths follow one naming scheme (`/node`, `/client`, `/browser`), and every package declares `exports`; for example, import `event-store/node` instead of `event-store/sqlite`. Package roots are browser-safe.

## 1.2.0

### Minor Changes

- [#477](https://github.com/JollyPixel/editor/pull/477) [`cd04886`](https://github.com/JollyPixel/editor/commit/cd048869b91af6a09ff56c73b8701b47fc13d78e) Thanks [@fraxken](https://github.com/fraxken)! - Add `CornerResizeHandle` for resizing both axes at once from a single pointer drag.

## 1.1.0

### Minor Changes

- [#467](https://github.com/JollyPixel/editor/pull/467) [`0d4d6e5`](https://github.com/JollyPixel/editor/commit/0d4d6e55d71d8416a160d067df9f4613a54ad263) Thanks [@fraxken](https://github.com/fraxken)! - Add bounded pointer and keyboard resizing, collapsible handles, accessibility support, cleanup, and a Vite demo. Rename `collapsable` to `collapsible`.
