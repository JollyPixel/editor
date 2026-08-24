# @jolly-pixel/ui

## 1.1.0

### Minor Changes

- [#516](https://github.com/JollyPixel/editor/pull/516) [`66ee3e0`](https://github.com/JollyPixel/editor/commit/66ee3e0740bcf6ec96a507ad47c9d565a9750a48) Thanks [@fraxken](https://github.com/fraxken)! - Implement a new loop engine/workspace

- [#502](https://github.com/JollyPixel/editor/pull/502) [`db58ed4`](https://github.com/JollyPixel/editor/commit/db58ed4f87cd137eb7e3a0470e75febcbad5034b) Thanks [@fraxken](https://github.com/fraxken)! - Migrate pixel-art editors to use @jolly-pixel/ui

- [#487](https://github.com/JollyPixel/editor/pull/487) [`71953e5`](https://github.com/JollyPixel/editor/commit/71953e5e7d63eddb44702d8ab8897536e27b363f) Thanks [@fraxken](https://github.com/fraxken)! - Add the DOM-free `StatsRecorder` API and the themeable, cycling `jolly-stats` performance HUD. Replace stats.js with the JollyPixel recorder and HUD, with optional mounting and top-corner placement.

- [#494](https://github.com/JollyPixel/editor/pull/494) [`9b87bfe`](https://github.com/JollyPixel/editor/commit/9b87bfe6de642aaf3ea9d25a09dd3b022bb8f8dc) Thanks [@fraxken](https://github.com/fraxken)! - Add math components (Vector2, Vector3, Vector4, Quaternion, Point2D etc)

- [#477](https://github.com/JollyPixel/editor/pull/477) [`cd04886`](https://github.com/JollyPixel/editor/commit/cd048869b91af6a09ff56c73b8701b47fc13d78e) Thanks [@fraxken](https://github.com/fraxken)! - Add `CornerResizeHandle` for resizing both axes at once from a single pointer drag.

- [#486](https://github.com/JollyPixel/editor/pull/486) [`d89455e`](https://github.com/JollyPixel/editor/commit/d89455e2093dd644ee67debadd0d7177857a6a59) Thanks [@fraxken](https://github.com/fraxken)! - Implement <jolly-progress> and <jolly-loading> inside UI and use them in runtime

### Patch Changes

- [#483](https://github.com/JollyPixel/editor/pull/483) [`b4a7046`](https://github.com/JollyPixel/editor/commit/b4a704691b17dfec6cafc637c757c937913632b4) Thanks [@fraxken](https://github.com/fraxken)! - Fix `jolly-floating` painting under static content before its first interaction, and `jolly-theme-preferences` reporting zero height to `Pane.occupiedSize()`, which threw off dock drop indicators.

- [#483](https://github.com/JollyPixel/editor/pull/483) [`b4a7046`](https://github.com/JollyPixel/editor/commit/b4a704691b17dfec6cafc637c757c937913632b4) Thanks [@fraxken](https://github.com/fraxken)! - Fix `jolly-floating` not actually collapsing when the pane it holds folds — the window now shrinks to the pane's header instead of leaving empty space, and its height handles disable while folded.
- Updated dependencies [[`cd04886`](https://github.com/JollyPixel/editor/commit/cd048869b91af6a09ff56c73b8701b47fc13d78e)]:
  - @jolly-pixel/resize-handle@1.2.0

## 1.0.1

### Patch Changes

- Updated dependencies [[`0d4d6e5`](https://github.com/JollyPixel/editor/commit/0d4d6e55d71d8416a160d067df9f4613a54ad263)]:
  - @jolly-pixel/resize-handle@1.1.0
