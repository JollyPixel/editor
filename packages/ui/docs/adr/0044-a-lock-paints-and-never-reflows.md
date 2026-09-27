---
status: accepted
---

# A lock paints, and never reflows its field

A remote lock used to add a lock icon before the label, a padding band above and below the row, and
the holder's chip after the value. With no reserved gutter, which is how editors lay out their
panels, the label and the value moved sideways and the rows below moved down each time a peer
focused a field. Locks come and go at the pace of other people's focus, so a panel shook under
the local user's cursor while they were not touching it.

A lock now only paints: the holder's colour as the left bar and a tint of the row, with "Held by"
and the holder's name in the row's tooltip and in the control's `aria-description`. Peer chips are
drawn on the row's top corner, out of the flow, and only when no one holds the field; while it is
locked the tint already names the holder. This refines how ADR-0018 renders a lock; the lock
itself is unchanged.

## Considered Options

- **A lock badge on the row's corner.** Explicit, but a second glyph over the value for something
  the tint already shows.
- **A gutter reserved on every field with a `path`.** Nothing moves, but every collaborative field
  is indented all the time, for a state it is in rarely.

## Consequences

A lock has no glyph, so someone who does not see the tint learns of it from the tooltip, the
read-only control or the accessible description.
