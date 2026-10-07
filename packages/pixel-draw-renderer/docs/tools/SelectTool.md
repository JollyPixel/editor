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
  rotate(direction?: RotationDirection): boolean;
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

`true` when a completed selection exists, including while it is being moved or resized.

### `isFloating`

```ts
get isFloating(): boolean
```

`true` while a pasted selection has not been written to the buffer yet. Deselecting a floating selection deposits it; `delete()` cancels it. Any other selection is backed by the buffer and reports `false`.

## Selection bounds

A new rectangular selection is clipped to the texture when the drag ends. A rectangle outside the texture is discarded. New rectangle and shape selections containing only one selected pixel are also discarded.

The selection is discarded, without depositing a floating paste, whenever the document emits `resized` or `replaced`: a resize, a texture replacement or clear, their undo and redo, the remote equivalents, and `loadSnapshot()`.

A move, transform, delete or deposit is one `select-edit` command listing only the pixels inside the texture.

## Selecting all

[`canvas.shortcuts.selectAll()`](../input/CanvasShortcuts.md) replaces the
selection with the full texture rectangle, including transparent pixels and
1×1 textures. It uses the current texture dimensions regardless of zoom,
pan, UV regions or shape mode. The shape setting stays unchanged.

A floating selection is deposited before capturing the full texture.
Otherwise selecting all changes no pixels and creates no history step.
It is available in the normal view, where pixel edits remain disabled.
During creation, movement or resizing, the shortcut returns `false` and
keeps the gesture intact.

## Grabbing a selection

A drag starts a move only when it begins on a selected pixel outside a resize handle. Masked-out cells inside the bounding rectangle are holes: clicking one starts a new selection instead. Dragging the interior of a rectangular selection moves it.

## Resizing a selection

Completed rectangular selections show four corner handles. Hovering a handle shows a diagonal resize cursor. Dragging it changes the selected area in whole texture pixels and keeps the opposite corner fixed. Handles remain the same screen size through zoom and pan.

The outline and size label update during the drag. The preview may extend beyond the texture; releasing clips the rectangle to the texture. If clipping leaves no pixels, the original selection is retained. Corners stop at a width and height of one pixel; resizing to `1×1` keeps the selection active.

Growing includes existing texture pixels and shrinking excludes them. Resizing changes no texture pixels and creates no history step or pixel command. Copy, move, delete and transforms use the corrected area after release. A drag that leaves the final rectangle unchanged retains the original selection content.

Shape mode, shape-masked selections and floating selections have no resize handles. Rectangular selections in the normal view can resize, while pixel edits remain unavailable. Moving a selection hides its handles until release.

Dragging continues outside the canvas element. Window blur finishes the resize; leaving select mode, changing shape mode, or replacing or resizing the texture discards it. Resize previews use the outline-only `selection-progress` payload with `phase: "creating"` and end with `selection-idle`, including when interrupted. They never emit `selection-committed`.

## Methods

### `rotate(direction?)` / `flipHorizontal()` / `flipVertical()` / `delete()`

```ts
rotate(direction?: "cw" | "ccw"): boolean
flipHorizontal(): boolean
flipVertical(): boolean
delete(): boolean
```

`rotate()` turns the selection 90 degrees around its center, clockwise by default or counter-clockwise with `"ccw"`. The flip methods mirror it horizontally or vertically.

Each method returns `true` when it applies the transform. It returns `false` when no selection is ready, including while a selection is being created, moved or resized.

`delete()` fills the selected mask with the configured selection erase color while keeping the selection active. On a floating selection it cancels the paste instead, clearing the selection and leaving the texture untouched.

Selection availability is event-driven through `PixelArtCanvas.selectionEvents`. The `selection-state-changed` event carries `hasSelection` and `isFloating`, and fires only when one of them changes.
