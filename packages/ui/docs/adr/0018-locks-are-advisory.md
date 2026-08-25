---
status: accepted
---

# Locks are advisory, and live in the holder's presence

Focusing a control publishes `editing: <path>` in that peer's presence; other clients render a
coloured bar and the holder's avatar, and the field becomes read-only. Two peers can claim at the
same moment, and correctness comes from last-write-wins at the data layer, not from the lock.
Cleanup is free, because the claim disappears with `peer-left`.

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

## Considered Options

- **Server-granted lock leases.** Needs a protocol, heartbeats and a reaper in `network`, and would
  block this package. `claim()` returns a `LockState` so a lease can replace the presence
  implementation later without touching components.
- **Adding "your id" to the sync envelope.** A protocol, server and client change, and the envelope
  is not sent at all to a lone first joiner.
- **Polling `room.peers` for the join snapshot.** Non-determinism in the tier already recorded as the
  flaky one, to work around a three-line omission in `network`.
