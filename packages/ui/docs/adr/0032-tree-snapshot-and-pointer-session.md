---
status: accepted
---

# Tree structure is indexed once and pointer mechanics have one owner

`jolly-tree` uses a `TreeSnapshot` as its canonical structural view. The
snapshot indexes nodes, parents, depths, ancestor chains, stable traversal
order, and visible rows in one pass. Compatibility helpers remain public, but
delegate to the same model. The component rebuilds its snapshot only when its
controlled `nodes` or `expanded` inputs change.

Pointer capture, pointer identity, movement thresholds, Escape handling, lost
capture, settlement, and teardown belong to `PointerDragSession`. Tree, dock,
and numeric scrubbing retain their own preview and commit policy. Owners keep a
cancellation handle and cancel it when disconnected.

Tree interaction state is one discriminated union. Idle, rename, pointer move,
and keyboard move cannot overlap, so settlement clears one state instead of a
collection of nullable fields.

## Consequences

- Structural checks during one rendered interaction reuse the same index.
- Pointer cancellation has the same meaning for tree, dock, and scrubbing.
- Public helper imports remain compatible while their implementation lives in
  `src/data/tree/model.ts`.
- Rendered gesture behavior remains a Playwright responsibility under ADR-0024.
