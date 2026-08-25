---
status: proposed
---

# A central shortcut registry, matching spatial bindings on `code` and commands on `key`

Deferred and unscheduled: nothing in the package registers a binding through it yet, and whether
user-rebindable shortcuts are wanted is still open. The design is recorded so it is ready when a
consumer asks; until then nothing in `src/input/` implements it.

`ui` never defines viewport bindings — camera and movement belong to `runtime` and `engine`. What it
would provide is the registry mechanism, bindings for its own controls, and application-level
bindings an editor registers. Scopes are `viewport`, `ui` and `global`, and only `global` fires in
both, which makes crossing the boundary a deliberate, greppable choice. Viewport bindings are not
registered but may be *declared* as reservations, so a collision can be detected without the registry
taking ownership of the behaviour.

Matching is per binding, because the two kinds want opposite things: spatial bindings match
`event.code` (physical position — `KeyW` is the key labelled Z on AZERTY, which is why ZQSD already
works), and command bindings match `event.key` (the key the user sees printed).

## Considered Options

- **Matching everything on `event.code`.** Undo lands on the key labelled W on AZERTY, which is what
  `pixel-draw-renderer` does today.
- **Matching everything on `event.key`.** Movement stops being a physical cluster and needs a remap
  table per layout.
- **Building the registry up front.** No phase registers a binding, so it would ship a subsystem for
  a requirement that has not been made.
