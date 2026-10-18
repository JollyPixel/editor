# `jolly-select`

`jolly-select` edits one value through a native select, or through a grid of
tiles in a popover. It implements the
[shared field API](../field/shared-field-api.md).

```ts
const field = document.querySelector("jolly-select");
field.options = [
  { value: "nearest", label: "Nearest" },
  { value: "linear", label: "Linear", disabled: true }
];
field.value = "nearest";
```

## Properties

```ts
interface Select<T> {
  options: JollyOption<T>[]; // property only
  layout: "list" | "grid"; // default "list"
  columns: number; // grid tiles per row, default 4
}
```

- Options are matched by position, so values may be strings, numbers or
  objects.
- A user selection emits `jolly-change`.
- Consecutive options with the same `group` form one group: an `optgroup` in
  the list, a labelled section in the grid.

## Grid

```ts
field.layout = "grid";
field.columns = 6;
field.options = [
  { value: "cube", label: "Cube", icon: "shape-cube", group: "Block" },
  { value: "ramp", label: "Ramp", icon: "shape-ramp", group: "Ramp" }
];
```

- The trigger shows the selected option's icon and label. A click, ArrowDown
  or ArrowUp opens the popover with focus on the selected tile.
- A tile shows the option's [registered icon](../icon/registry.md), or its
  label when it has none. Hovering a tile focuses it, and the focused tile's
  label is shown below the grid. Leaving the grid moves focus back to the
  selected tile.
- Arrow keys move through the grid row by row, across groups. Home and End
  jump to the first and last enabled tile. Enter or a click picks the tile and
  closes the popover.
- Focusing a tile emits `jolly-input` with its value, so a host can preview
  it. Closing the popover without a pick emits `jolly-input` with the current
  value again.
- The popover's right edge lines up with the trigger's.
- `--jolly-select-tile-size` sets the tile size, default `40px`.
