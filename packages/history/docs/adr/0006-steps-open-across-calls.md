---
status: accepted
---

# Steps open across calls

`open(scope, label)` returns `{ commit(), cancel() }`, and `record` is built on it. A brush stroke or
a placement spans pointer events, so a callback cannot hold it. Undo and redo return `false` while a
step is open, and an `open` inside another step joins it.

`cancel()` files nothing and keeps the changes made so far. A caller that wants them gone undoes
them itself, as voxel-map's lift does with unrecorded writes.

## Consequences

- A caller that never commits leaves undo disabled; editors commit on pointer release and on
  dispose.
