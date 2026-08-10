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
  readonly isFloating: boolean;
  rotate(): boolean;
  flipHorizontal(): boolean;
  flipVertical(): boolean;
  delete(): boolean;
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

### `isFloating`

```ts
get isFloating(): boolean
```

`true` while a pasted selection has not been written to the buffer yet. Deselecting a floating selection deposits it; `delete()` cancels it. Any other selection is backed by the buffer and reports `false`.

## Selection bounds

A rectangular selection is clipped to the texture when the drag ends. A rectangle outside the texture is discarded. Rectangle and shape selections containing only one selected pixel are also discarded.

## Grabbing a selection

A drag starts a move only when it begins on a selected pixel. Masked-out cells inside the bounding rectangle are holes: clicking one starts a new selection instead. Rectangular selections have no holes, so any point inside them grabs.

## Methods

### `rotate()` / `flipHorizontal()` / `flipVertical()` / `delete()`

```ts
rotate(): boolean
flipHorizontal(): boolean
flipVertical(): boolean
delete(): boolean
```

`rotate()` turns the selection 90 degrees clockwise around its center. The flip methods mirror it horizontally or vertically.

Each method returns `true` when it applies the transform. It returns `false` when no selection is ready, including while a selection is being created or moved.

`delete()` fills the selected mask with the configured selection erase color while keeping the selection active. On a floating selection it cancels the paste instead, clearing the selection and leaving the texture untouched.

Selection availability is event-driven through `PixelArtCanvas.selectionEvents`. The `selection-state-changed` event carries `hasSelection` and `isFloating`, and fires only when one of them changes.
