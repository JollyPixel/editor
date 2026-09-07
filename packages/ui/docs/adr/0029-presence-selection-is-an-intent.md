---
status: accepted
---

# A presence row raises a selection intent, and stays read-only

`jolly-presence` gained a `selectable` opt-in that renders remote rows as buttons emitting
`jolly-peer-select` with `{ clientId }`. The element still renders nothing but the snapshot it was
handed (ADR-0017): it holds no idea of what selecting a peer means, keeps no selected row, and
changes nothing about itself on a click. Hosts decide, the way voxel-map teleports its camera onto a
peer's frustum pose.

The local peer is never a button. Selecting yourself has no meaning any host has asked for, and a
row that looks pressable but does nothing is worse than plain text.

## Considered Options

- **Rows clickable unconditionally.** Every consumer would inherit a hover affordance and a keyboard
  stop for an interaction its host does not implement.
- **A `selected` property on the element.** Selection here is a one-shot action, not a state the
  list holds; a peer is not left highlighted after the host acts on it.
- **The element filtering rows it deems actionable.** Whether a peer can be acted on is host
  knowledge (voxel-map: whether a frustum pose has landed yet), and reading it would pull transport
  awareness back into a view ADR-0017 keeps free of it.
- **A cancelable event.** Nothing to prevent: the element mutates neither itself nor the host
  (ADR-0023).

## Consequences

A click on a peer the host cannot act on is a no-op the element cannot signal.
