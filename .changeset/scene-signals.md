---
"@jolly-pixel/physics": major
---

`SignalEvent.connect` returns a `SignalConnection`, takes `{ once }`, and `next()` awaits the following emit; `ActorComponent.listen` disconnects on destroy. Scene files wire signals to methods through component `connections`.
`UISprite` signals are renamed to `pointerEntered`, `pointerExited`, `pointerPressed`, `pointerReleased`, `clicked`, `doubleClicked`, `rightClicked` (`onHover` removed), and `RigidBody.contacts` splits into `contactStarted` and `contactEnded`.
