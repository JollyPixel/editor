# UVTool

Configures UV-mode editing. `PixelArtCanvas` exposes it as `canvas.tools.uv`.

```ts
canvas.mode = "uv";
canvas.tools.uv.resizable = true;
```

## Types

```ts
interface UVTool {
  resizable: boolean;
}
```

## Properties

### `resizable`

```ts
get resizable(): boolean
set resizable(value: boolean)
```

Shows handles on the selected region and lets them resize it. It starts from [`uv.resizable`](../PixelArtCanvasOptions.md#uvresizable), which defaults to `false`. Turning it off cancels a resize in progress.

Handles follow the region state, as [`UVRegion.resized()`](../uv/UVRegion.md#resizedrect-slot-options) describes:

- **stacked**: the shared rectangle.
- **free**: the selected slot.
- **unfolded**: every active face, so any face of the net can be resized without selecting it first. A net face resizes by its east and south edges only: no corner is drawn and a corner acts as the closer of the two. The net's top-left corner never moves, faces grow right or down, and a line shared by two faces always resizes the face before it, whichever side it is grabbed from.

Stacked and free rectangles draw their corners. Edges are grabbed anywhere along the border, a few canvas pixels on either side. The hovered handle sets the cursor. A small rectangle keeps its middle third free for moving it. Regions with a triangle or compound face show no handles.

Dragging snaps to whole texture pixels and keeps the opposite edge in place. Handles hide while a region is moved or resized and come back on release. The overlay previews the result, and the map emits `"region-dragging"` with the resized region on each move, as it does for a move drag. On release the map commits through [`UVMap.resize()`](../uv/UVMap.md#resizeid-rect-slot-options), which records one history entry. Leaving UV mode or losing focus cancels the drag. Both end with `"region-drag-ended"`.

While [`shortcuts.lineHeld`](../input/CanvasShortcuts.md#lineheld) is `true`, usually bound to `Shift`, resizing a net face resizes its aligned row or column with it: every face whose bottom (or right) edge lies on the same line and touches the dragged face along it, directly or through another such face, moves that edge too. Changing it mid-drag updates the preview at once. Stacked and free regions ignore it.
