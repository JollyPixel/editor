# SelectTool

Configures selection behavior and transforms the current selection. `PixelArtCanvas` exposes it as `canvas.tools.select`.

```ts
canvas.mode = "select";
canvas.tools.select.shape = true;
```

## Types

```ts
interface SelectTool {
  shape: boolean;
  readonly hasSelection: boolean;
  rotate(): boolean;
  flipHorizontal(): boolean;
  flipVertical(): boolean;
}
```

## Properties

### `shape`

```ts
get shape(): boolean
set shape(value: boolean)
```

When `false`, dragging creates a rectangular selection. When `true`, clicking selects the four-connected region with the same RGBA value. Fully enclosed areas are included in a shape selection.

The default is `false`. Changing the value clears the current selection.

### `hasSelection`

```ts
get hasSelection(): boolean
```

`true` when a completed selection exists, including while it is being moved.

## Selection bounds

A rectangular selection is clipped to the texture when the drag ends. A rectangle outside the texture is discarded. Rectangle and shape selections containing only one selected pixel are also discarded.

## Methods

### `rotate()` / `flipHorizontal()` / `flipVertical()`

```ts
rotate(): boolean
flipHorizontal(): boolean
flipVertical(): boolean
```

`rotate()` turns the selection 90 degrees clockwise around its center. The flip methods mirror it horizontally or vertically.

Each method returns `true` when it applies the transform. It returns `false` when no selection is ready, including while a selection is being created or moved.
