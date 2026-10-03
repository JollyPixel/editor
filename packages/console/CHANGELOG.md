# @jolly-pixel/console

## 1.2.0

### Minor Changes

- [#873](https://github.com/JollyPixel/editor/pull/873) [`eedfaa1`](https://github.com/JollyPixel/editor/commit/eedfaa1d70238285bffcf9cfc920a945ed305119) Thanks [@fraxken](https://github.com/fraxken)! - Add `ConsoleServer` and `ConsoleMirror` to serve a console's namespaces over a `MessagePort` and show them in another page's console.
  A variable `set` may now return a promise, and `jolly-console` emits `opened` on its `CommandConsole` each time it shows.

### Patch Changes

- Updated dependencies [[`f03cb7a`](https://github.com/JollyPixel/editor/commit/f03cb7a89b574ba6965f3b88d0ad5796de6cbdce), [`e780033`](https://github.com/JollyPixel/editor/commit/e7800335b131d45645d4a62459684993d8b87af8), [`425cef9`](https://github.com/JollyPixel/editor/commit/425cef984d0c6e5bf06f99fa29e0282acb47350b)]:
  - @jolly-pixel/ui@3.3.0

## 1.1.0

### Minor Changes

- [#840](https://github.com/JollyPixel/editor/pull/840) [`1452db0`](https://github.com/JollyPixel/editor/commit/1452db0b72b073fbb4c5c46fd37dfe748da1e7f7) Thanks [@fraxken](https://github.com/fraxken)! - Export `isToggleShortcut` and make `jolly-console`'s `toggle()` public, so a framed page can forward Ctrl+K to another window's console.

### Patch Changes

- [#834](https://github.com/JollyPixel/editor/pull/834) [`3795267`](https://github.com/JollyPixel/editor/commit/37952670b39501299cd97be272d1da1704f68c97) Thanks [@fraxken](https://github.com/fraxken)! - Add `AmbientThemeController`: `jolly-dialog` and `jolly-console` now follow page theme changes while open, including a switch to `auto`.
- Updated dependencies [[`3795267`](https://github.com/JollyPixel/editor/commit/37952670b39501299cd97be272d1da1704f68c97), [`921c7a6`](https://github.com/JollyPixel/editor/commit/921c7a6ae7195ba5099b964416145865eff269e4), [`e1c4a2d`](https://github.com/JollyPixel/editor/commit/e1c4a2d163156a30dd89a432fd801eb23c4687c4), [`799d17c`](https://github.com/JollyPixel/editor/commit/799d17cd8d7732d84664b0109648fb353bd3ad0e), [`f2182da`](https://github.com/JollyPixel/editor/commit/f2182da4d77756bf62bf2c12d4ca2a41fedd76ab), [`e1c4a2d`](https://github.com/JollyPixel/editor/commit/e1c4a2d163156a30dd89a432fd801eb23c4687c4), [`a54b8a8`](https://github.com/JollyPixel/editor/commit/a54b8a8bdf5597293fcb1a960ed35aeb0a57d603), [`75d0d66`](https://github.com/JollyPixel/editor/commit/75d0d666a436bb8399fda93930da84c16b02f93a), [`6339aea`](https://github.com/JollyPixel/editor/commit/6339aea20bf9777054eec1e6cb828d40fe96c3cc), [`ad38d4e`](https://github.com/JollyPixel/editor/commit/ad38d4e8935e0a759c0d4f7add3771ab0543f9b0), [`10f797b`](https://github.com/JollyPixel/editor/commit/10f797bb711798024f7ed82ed6c615e12de54e3d), [`b691bbf`](https://github.com/JollyPixel/editor/commit/b691bbf91d44d5d5fa65d32165e6d0688d82e06a), [`1452db0`](https://github.com/JollyPixel/editor/commit/1452db0b72b073fbb4c5c46fd37dfe748da1e7f7), [`ab4ad1a`](https://github.com/JollyPixel/editor/commit/ab4ad1a00b61463b39aaaae73644ca329898b8de)]:
  - @jolly-pixel/ui@3.2.0
