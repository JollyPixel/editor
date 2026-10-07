---
status: accepted
---

# One guard per document part, over typed written keys

A step part has one `HistoryGuard` from `keys.guard(commands)`: `touches(written)`, `capture()`
and `same(captured)`, the capture typed by the registration. `written` is what `keys.written(change)` returns, typed by the
registration: strings by default, packed pixels or voxel cells for documents with many small keys.

The first version kept one JSON string per guarded key and walked every key of every step on each
local change. Pixels and voxel cells are keys: a 256x256 fill held 65k strings per step. Pixel
guards now keep packed indices and capture typed arrays; voxel guards keep packed cells per layer.
`KeyedGuard` keeps the per-key JSON behaviour for small documents such as voxel-model.

The guard and the written keys of one registration always come from the same document, so the
comparison never needs a shared string form. A string key set contract, tried before, made pixel
and voxel sets parse keys back, and a whole voxel layer report a size of `Infinity` so an
intersection iterated the other side.

## Consequences

- A local change recaptures only the parts whose keys it writes.
- A registration may `compact` a part's commands when the step is filed, so a brush stroke undoes
  as one patch per layer instead of one per stamp.
