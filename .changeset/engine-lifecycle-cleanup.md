---
"@jolly-pixel/engine": major
"@jolly-pixel/runtime": patch
---

Fix double actor destruction, leaked component and listener teardowns, playlists that stopped after one track, squared master volume, `**/a/b` actor paths, and non-looping sprite animations.
Breaking: components override `onDestroy()` (with `addTeardown()`), `ThreeRenderer.create(canvas, options)` and `draw(scene)` drop `sceneManager`/render modes/`onDraw`, `GlobalAudio` drops observers, and `SpriteRenderer.texture` is an asset reference.
