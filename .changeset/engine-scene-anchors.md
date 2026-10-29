---
"@jolly-pixel/engine": minor
---

Add scene anchors: a `ComponentDefinition` can publish `anchors(component)`, and a `SceneActorFile` with `anchor` hangs from one of its parent's.
`SceneInstance` follows anchor moves and is a `SceneAnchorsReader` (`anchors()`, `findAnchor()`), with an `anchorsChange` event and an `anchor` argument to `reparent()`; captures keep `anchor`.
