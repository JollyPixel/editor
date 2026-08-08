# SelectTool

Public API for `"select"` mode, reached via [`PixelArtCanvas.tools.select`](../PixelArtCanvas.md#tools).

```ts
export interface SelectTool {
  shape: boolean;
  readonly hasSelection: boolean;
  rotate(): boolean;
  flipHorizontal(): boolean;
  flipVertical(): boolean;
}
```

## `shape`

Controls selection start behavior:

- `false` (default): start rectangle selection.
- `true`: magic-wand selection from the clicked connected region.

Runtime-only (no constructor option). Changing it clears the current selection.

> [!IMPORTANT]
> A connected region smaller than 2 pixels does not produce a selection; the click is a no-op.

## Rectangle bounds

A rectangle selection may extend beyond the texture while it is being drawn.
When the gesture ends, the selection is clipped to the texture bounds. A
rectangle that does not overlap the texture is discarded.

## `hasSelection`

Read-only. `true` when there is a committed selection to transform; otherwise `false`.

## `rotate` / `flipHorizontal` / `flipVertical`

Programmatic transforms for the active selection.

- `rotate()`: rotate 90 degrees clockwise around selection center.
- `flipHorizontal()`: mirror selection horizontally.
- `flipVertical()`: mirror selection vertically.

Each method returns `false` and does nothing when there is no active selection.
