# `jolly-layer-grid`

`jolly-layer-grid` shows up to 32 numbered cells in blocks of two rows, like
the layer fields of the Godot inspector. It edits a bitmask or one index, and
implements the [shared field API](../field/shared-field-api.md).

```ts
const field = document.createElement("jolly-layer-grid");
field.label = "Cull mask";
field.names = {
  0: "Default",
  1: "Player"
};
field.value = 0b101;
```

For a few bits that each need a visible name, use [`jolly-flags`](./flags.md).

## Properties

```ts
interface LayerGrid {
  mode: "mask" | "index"; // default "mask"
  count: number; // 1 to LayerGrid.MaxCount (32), default 20
  columns: number; // cells per row of one block, default 5
  start: number; // number shown on the first cell, default 1
  names: Readonly<Record<number, string>>; // by cell index
  value: number | typeof Mixed; // default 0
}
```

- `"mask"`: `value` is a 32-bit mask, cell `i` is bit `2 ** i`. Bits past
  `count` are kept.
- `"index"`: `value` is the selected cell, from `0`. A value out of range
  selects none.
- `count` is truncated and clamped.
- Each block holds `columns * 2` cells, row by row: by default 1 to 5 above
  6 to 10. Zero or less uses `5`. Blocks wrap when the field is narrow.
- `start` changes labels only. Set `0` to show the index.
- A named cell's tooltip and accessible name read `"3: Terrain"`. The cell
  still shows its number.
- `Mixed`: every cell is `aria-checked="mixed"` in `"mask"` mode, and the first
  edit keeps only the pressed bit. No cell is selected in `"index"` mode.

## Pointer

- `"mask"`: pressing toggles a cell. Dragging paints every crossed cell with
  the state of the first one.
- `"index"`: pressing selects a cell. Dragging moves the selection.
- Each painted cell emits `jolly-input`. Release emits one `jolly-change`.
- Escape during a drag restores the value from before the press, as
  `jolly-input`. A drag started on `Mixed` has nothing to restore.
- A disabled, read-only or locked field ignores presses.

## Keyboard

- One tab stop, none when disabled.
- Arrow keys move within a block's two rows and across blocks. Home and End
  jump to the first and last cell.
- Space toggles or selects. In `"index"` mode, arrow keys also select and emit
  `jolly-change`.
- Roles: `group` of `checkbox` cells in `"mask"` mode, `radiogroup` of `radio`
  cells in `"index"` mode.

## Facade

`view: "layers"` on a number binding builds this element. See
[per-element options](../facade/binding.md#per-element-options).
