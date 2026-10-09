# `jolly-layer-grid`

`jolly-layer-grid` shows up to 32 numbered cells in blocks of two rows, like
the layer and mask fields of the Godot inspector. It edits either a bitmask
or a single index, and implements the
[shared field API](../field/shared-field-api.md).

```ts
const field = document.createElement("jolly-layer-grid");
field.label = "Cull mask";
field.names = {
  0: "Default",
  1: "Player"
};
field.value = 0b101;
```

Use [`jolly-flags`](./flags.md) instead for a few bits that each need a
visible name.

## Properties

### `mode`

`"mask" | "index"`, reflected. Defaults to `"mask"`.

In `"mask"` mode `value` is an unsigned 32-bit mask and cell `i` shows bit
`2 ** i`. Bits past `count` are kept as they are when a cell is toggled.

In `"index"` mode `value` is the index of the selected cell, counted from
`0`. A value outside `0..count - 1` selects no cell.

### `count`

`number`. Number of cells, from `1` to `32` (`LayerGrid.MaxCount`). Defaults
to `20`. Fractions are truncated and values outside the range are clamped.

### `columns`

`number`. Cells per row of one block. Each block holds `columns * 2` cells,
filled row by row, so the default `5` puts cells 1 to 5 above 6 to 10, and 11
to 15 above 16 to 20. Zero or less uses the default; other values are clamped
to `1..count`. Blocks sit side by side and wrap onto a new line when the field
is too narrow for them.

### `start`

`number`. Number shown on the first cell. Defaults to `1`, so index `0` reads
"1" as in Godot. Set it to `0` to show the index itself. It changes labels
only, never `value`.

### `names`

`Readonly<Record<number, string>>`, keyed by cell index. Defaults to `{}`. A
named cell gets the tooltip and accessible name `"3: Terrain"`; the cell still
shows its number.

### `value`

`number | typeof Mixed`. Defaults to `0`. In `"mask"` mode a mixed value
marks every cell `aria-checked="mixed"`, and the first edit resolves to the
pressed bit alone. In `"index"` mode a mixed value selects no cell.

## Interaction

In `"mask"` mode, pressing a cell toggles it. Moving the pointer with the
button held paints every cell it crosses with the state the first cell took,
so a drag can switch a run of layers on or off. In `"index"` mode, pressing a
cell selects it and dragging moves the selection.

Each painted cell emits `jolly-input` with the new value, and release emits
one `jolly-change`. Escape during a drag emits `jolly-input` with the value
from before the press and no `jolly-change`; a drag that started on a mixed
value has nothing to restore, so Escape emits nothing. A disabled, read-only or
locked field ignores presses.

The grid is one tab stop. Arrow keys move focus within a block's two rows and
across blocks along the same row, Home and End jump to the first and last
cell, and Space toggles or selects the focused cell. In `"index"` mode arrow
keys also select, and each move emits `jolly-change`. A disabled grid has no
tab stop.

The grid has the `group` role with `checkbox` cells in `"mask"` mode, and
the `radiogroup` role with `radio` cells in `"index"` mode.

## Facade

A number binding with `view: "layers"` builds this element, whether or not it
also has `min` and `max`. `count`, `columns`, `mode`, `start` and `names` are
forwarded.

```ts
pane.addBinding(camera, "cullMask", {
  label: "Cull mask",
  view: "layers",
  count: 20
});

pane.addBinding(model, "lod", {
  label: "LOD",
  view: "layers",
  mode: "index",
  count: 8,
  columns: 4
});
```
