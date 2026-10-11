# @jolly-pixel/console

## 1.2.0

### Minor Changes

- [#926](https://github.com/JollyPixel/editor/pull/926) [`4ae0389`](https://github.com/JollyPixel/editor/commit/4ae03892c7f32bf044f3df232791aaae2a33dfff) Thanks [@fraxken](https://github.com/fraxken)! - Add `string[]`, `number[]` and `boolean[]` variables whose items are space-separated at the prompt and in `/script`, with revert, completion and mirrored consoles.
  `ConsoleValue` now includes item arrays; command arguments use the new `ConsoleScalar`.

- [#923](https://github.com/JollyPixel/editor/pull/923) [`26e5688`](https://github.com/JollyPixel/editor/commit/26e56886332893e949a9a98ce5e6a35acb614044) Thanks [@fraxken](https://github.com/fraxken)! - Namespaces nest by dotted address (`pixelart.keybinds`), with implicit parents; `RegisteredNamespace.name` is now the last part of the address.
  Add `/cd` with `CommandConsole.scope`, `scoped` and `enter()`; the prompt shows the scope and `/help` and `/script` default to it.

- [#873](https://github.com/JollyPixel/editor/pull/873) [`eedfaa1`](https://github.com/JollyPixel/editor/commit/eedfaa1d70238285bffcf9cfc920a945ed305119) Thanks [@fraxken](https://github.com/fraxken)! - Add `ConsoleServer` and `ConsoleMirror` to serve a console's namespaces over a `MessagePort` and show them in another page's console.
  A variable `set` may now return a promise, and `jolly-console` emits `opened` on its `CommandConsole` each time it shows.

- [#906](https://github.com/JollyPixel/editor/pull/906) [`2dd81ec`](https://github.com/JollyPixel/editor/commit/2dd81ece14b1ae5166e4a575bf9f80892e73b4cb) Thanks [@fraxken](https://github.com/fraxken)! - Add the `/revert [count]` and `/script [namespace]` built-ins: variable writes and commands returning a revert function from `execute` can be undone, and `/script` edits variables as INI text saved all or nothing as one revert step.
  The registry and its namespaces are iterable (entries carry `address` and `description`), `InputHistory` adds `browsing`, `size` and `stopBrowsing()`, and a throwing `get` no longer breaks a `ConsoleServer` snapshot.
  Search and rendering allocate less per keystroke, and `scrollback` returns the same frozen array until it changes.

### Patch Changes

- [#955](https://github.com/JollyPixel/editor/pull/955) [`d0830c5`](https://github.com/JollyPixel/editor/commit/d0830c5276df2bfa92f929ff149b3da2fe5b752e) Thanks [@fraxken](https://github.com/fraxken)! - Focus the textarea when opening an overflowing variables script.
  Prevent Chrome's scroll-container focus ring and allow typing immediately.

- [#923](https://github.com/JollyPixel/editor/pull/923) [`8ad0cae`](https://github.com/JollyPixel/editor/commit/8ad0cae03f88cfa9c2fef2981b39a3a0b8ff36c0) Thanks [@fraxken](https://github.com/fraxken)! - Remove the focus outline drawn around the `/script` editor.
- Updated dependencies [[`c0643f9`](https://github.com/JollyPixel/editor/commit/c0643f9978941d93eb2fee7ca4d524fc20e23339), [`86dbb95`](https://github.com/JollyPixel/editor/commit/86dbb95270aae8eb3cc89a76d518a51fe93faebf), [`5d51844`](https://github.com/JollyPixel/editor/commit/5d51844c63797adadd53070d1080e1c151cf343e), [`f03cb7a`](https://github.com/JollyPixel/editor/commit/f03cb7a89b574ba6965f3b88d0ad5796de6cbdce), [`912d0f7`](https://github.com/JollyPixel/editor/commit/912d0f702ab8697c5a501df6289674e97c498059), [`a23ea74`](https://github.com/JollyPixel/editor/commit/a23ea74dca38f8684e890f0abed659277ccc230e), [`9ed0ad8`](https://github.com/JollyPixel/editor/commit/9ed0ad82e1bc15518d64314cf1859dee71c1bb5d), [`ef2c7fe`](https://github.com/JollyPixel/editor/commit/ef2c7fe37e1d532b745e6462c26bb9f650ccc875), [`66697bd`](https://github.com/JollyPixel/editor/commit/66697bd469e84f261a4b1a018720b92d33befd04), [`12dca6e`](https://github.com/JollyPixel/editor/commit/12dca6e98be8b71f9ef8517edcc17d8e8520fb72), [`a75ee6d`](https://github.com/JollyPixel/editor/commit/a75ee6dc5ef94c274f0f3b69d8eeff73e018e495), [`e1808f6`](https://github.com/JollyPixel/editor/commit/e1808f6a02cf3569d5838a601dcc0946d8fbb164), [`f724870`](https://github.com/JollyPixel/editor/commit/f72487033a8df5e7077e37780082c72f7c99688a), [`5e9f29d`](https://github.com/JollyPixel/editor/commit/5e9f29d41de26d6bc738f36e8cb5f80b03a55e90), [`3e9603a`](https://github.com/JollyPixel/editor/commit/3e9603ad94b7a4751a13e7232651a584b93a75e2), [`2f1c4ad`](https://github.com/JollyPixel/editor/commit/2f1c4ad18ecb8ce413d3951899c6096af666e9fb), [`26b8b55`](https://github.com/JollyPixel/editor/commit/26b8b551d00aa70ea11b7b7e0097f70c1da43dc3), [`d4b3ad1`](https://github.com/JollyPixel/editor/commit/d4b3ad1a7cab4677c23f671e391ae95b2dffe860), [`e780033`](https://github.com/JollyPixel/editor/commit/e7800335b131d45645d4a62459684993d8b87af8), [`4647e7d`](https://github.com/JollyPixel/editor/commit/4647e7dc2eeb6a9c331677fdc06440c4e049f556), [`425cef9`](https://github.com/JollyPixel/editor/commit/425cef984d0c6e5bf06f99fa29e0282acb47350b), [`c86b214`](https://github.com/JollyPixel/editor/commit/c86b214c710a64428fa251465f3bcd7984471a36), [`d3cc3ee`](https://github.com/JollyPixel/editor/commit/d3cc3ee8679f691f130274eadd074ca717e52346)]:
  - @jolly-pixel/ui@4.0.0

## 1.1.0

### Minor Changes

- [#840](https://github.com/JollyPixel/editor/pull/840) [`1452db0`](https://github.com/JollyPixel/editor/commit/1452db0b72b073fbb4c5c46fd37dfe748da1e7f7) Thanks [@fraxken](https://github.com/fraxken)! - Export `isToggleShortcut` and make `jolly-console`'s `toggle()` public, so a framed page can forward Ctrl+K to another window's console.

### Patch Changes

- [#834](https://github.com/JollyPixel/editor/pull/834) [`3795267`](https://github.com/JollyPixel/editor/commit/37952670b39501299cd97be272d1da1704f68c97) Thanks [@fraxken](https://github.com/fraxken)! - Add `AmbientThemeController`: `jolly-dialog` and `jolly-console` now follow page theme changes while open, including a switch to `auto`.
- Updated dependencies [[`3795267`](https://github.com/JollyPixel/editor/commit/37952670b39501299cd97be272d1da1704f68c97), [`921c7a6`](https://github.com/JollyPixel/editor/commit/921c7a6ae7195ba5099b964416145865eff269e4), [`e1c4a2d`](https://github.com/JollyPixel/editor/commit/e1c4a2d163156a30dd89a432fd801eb23c4687c4), [`799d17c`](https://github.com/JollyPixel/editor/commit/799d17cd8d7732d84664b0109648fb353bd3ad0e), [`f2182da`](https://github.com/JollyPixel/editor/commit/f2182da4d77756bf62bf2c12d4ca2a41fedd76ab), [`e1c4a2d`](https://github.com/JollyPixel/editor/commit/e1c4a2d163156a30dd89a432fd801eb23c4687c4), [`a54b8a8`](https://github.com/JollyPixel/editor/commit/a54b8a8bdf5597293fcb1a960ed35aeb0a57d603), [`75d0d66`](https://github.com/JollyPixel/editor/commit/75d0d666a436bb8399fda93930da84c16b02f93a), [`6339aea`](https://github.com/JollyPixel/editor/commit/6339aea20bf9777054eec1e6cb828d40fe96c3cc), [`ad38d4e`](https://github.com/JollyPixel/editor/commit/ad38d4e8935e0a759c0d4f7add3771ab0543f9b0), [`10f797b`](https://github.com/JollyPixel/editor/commit/10f797bb711798024f7ed82ed6c615e12de54e3d), [`b691bbf`](https://github.com/JollyPixel/editor/commit/b691bbf91d44d5d5fa65d32165e6d0688d82e06a), [`1452db0`](https://github.com/JollyPixel/editor/commit/1452db0b72b073fbb4c5c46fd37dfe748da1e7f7), [`ab4ad1a`](https://github.com/JollyPixel/editor/commit/ab4ad1a00b61463b39aaaae73644ca329898b8de)]:
  - @jolly-pixel/ui@3.2.0
