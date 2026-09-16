---
status: accepted
---

# A double dock is one dock with two columns, not two docks

A `double` dock keeps its second column in the same `DockState`, as
`secondary` next to `groups`. The projection moves a slot into the column by
setting `slot="secondary"` on it. Size, collapse and visibility stay on the
dock, so both columns resize, collapse and hide together, and `size` stays the
width of one column.

Transitions address a column with `{ dock, column }`. A plain dock key still
means the primary column, so existing callers are unchanged. After every
transition, a dock whose primary column is empty takes the secondary groups,
so no empty strip stays against the screen edge.

## Considered Options

- **Two authored docks side by side.** This already half works, but each dock
  has its own handle, size and collapse state, and nothing keeps the widths
  equal.
- **A derived dock key for the second column.** Every transition would work
  unchanged, but size, collapse and visibility would need special cases to
  follow the parent dock.

## Consequences

- `PanePlacement` gains `column`, and consumers that compare placements must
  compare it too. voxel-map's texture host rule did.
- The second column opens only by dropping a pane on it or moving one there
  with the keyboard. There is no splitter, and the columns are always equal.
- A dock that stops being `double` returns its stored second column to the
  primary one.
