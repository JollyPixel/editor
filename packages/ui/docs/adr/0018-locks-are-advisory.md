---
status: accepted
---

# Locks are advisory, live in the holder's presence, and only paint

Focusing a control publishes `editing: <path>` in that peer's presence; other clients mark the field
and make it read-only. Two peers can claim at the same moment, and correctness comes from
last-write-wins at the data layer, not from the lock. Cleanup is free, because the claim disappears
with `peer-left`.

Three rules follow, each invisible in a single browser:

- `lockedBy` is only ever a *remote* peer. A field publishes the path it is editing and reads the
  same presence back, so without this it locks itself out under its own user's cursor.
- Local focus beats a remote claim, so neither peer loses the field they are typing in. The peer who
  arrives second still sees the first as holder: asymmetric, but coherent on each side.
- A release publishes `editing: null`, never `undefined`. `JSON.stringify` omits an undefined value,
  so the patch arrives empty, merges nothing, and leaves the field locked for every other peer until
  that one disconnects.

`peers` includes the local peer; an adapter over a transport that omits the caller from its own peer
list synthesizes that entry.

`path` is a plain property on every field, `null` by default, which opts the field out of locking.
Two clients must compute the same string, and a path derived from a label or a DOM position only
agrees while both render an identical tree — untrue as soon as a selection is involved, where the
domain id is knowledge only the consumer has.

A lock never reflows its field. It paints the holder's colour as the left bar and a tint of the row,
with "Held by" and the holder's name in the tooltip and the control's `aria-description`. Peer chips
sit on the row's top corner, out of the flow, and only while no one holds the field. Locks come and
go at the pace of other people's focus, so anything that moved the label, the value or the rows
below would shake a panel under a user who is not touching it.

## Considered Options

- **Server-granted lock leases.** Needs a protocol, heartbeats and a reaper in `network`, and would
  block this package. `claim()` returns a `LockState` so a lease can replace the presence
  implementation later without touching components.
- **Adding "your id" to the sync envelope.** A protocol, server and client change, and the envelope
  is not sent at all to a lone first joiner.
- **Deriving a path from the label or container chain.** Duplicate labels collide silently, and for a
  lock that means two unrelated fields locking each other across machines.
- **Consumers assigning `lockedBy` per field.** Twelve files instead of one, the argument that put
  the field contract on a base class (ADR-0003).
- **A lock icon and holder chip in the row's flow.** The previous design; rows moved each time a
  peer focused a field.
- **A gutter reserved on every field with a `path`.** Nothing moves, but every collaborative field
  is indented all the time, for a state it is in rarely.

## Consequences

A lock has no glyph, so someone who does not see the tint learns of it from the tooltip, the
read-only control or the accessible description.
