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

Shows handles on the selected region in UV mode and lets them resize it. Other modes hide them. It starts from [`uv.resizable`](../PixelArtCanvasOptions.md#uvresizable), which defaults to `false`. Turning it off cancels a resize in progress.

Handles follow the region state, as [`UVRegion.resized()`](../uv/UVRegion.md#resizedrect-slot-options) describes:

- **stacked**: the shared rectangle.
- **free**: the selected slot.
- **unfolded**: every active face, so any face of the net can be resized without selecting it first. A net face resizes by its east and south edges only: no corner is drawn and a corner acts as the closer of the two. The net's top-left corner never moves, faces grow right or down, and a line shared by two faces always resizes the face before it, whichever side it is grabbed from.

Stacked and free rectangles draw their corners. Edges are grabbed anywhere along the border, a few canvas pixels on either side. The hovered handle sets the cursor. A small rectangle keeps its middle third free for moving it. Regions with a triangle or compound face show no handles.

Dragging snaps to whole texture pixels and keeps the opposite edge in place. Handles hide from pointer-down until release. The overlay previews the result, and the map emits `"region-dragging"` with the initial region on pointer-down and the previewed region on each move, for both move and resize drags. On release the map commits through [`UVMap.resize()`](../uv/UVMap.md#resizeid-rect-slot-options), which records one history step. Leaving UV mode or losing focus cancels the drag. Both end with `"region-drag-ended"`, including a click that made no change.

While a peer drag preview is active, that region's handles hide and new local move and resize gestures on it are blocked. This applies to the whole region even when the peer edits one slot. Other regions remain editable. Handles return when the last peer preview for the region is removed, using the stored geometry. Presence blocks gestures after it arrives; simultaneous starts still require server arbitration for strict mutual exclusion.

While [`shortcuts.lineHeld`](../input/CanvasShortcuts.md#lineheld) is `true`, usually bound to `Shift`, resizing a net face resizes its aligned row or column with it: every face whose bottom (or right) edge lies on the same line and touches the dragged face along it, directly or through another such face, moves that edge too. Changing it mid-drag updates the preview at once. Stacked and free regions ignore it.

## Carrying nested regions

While [`shortcuts.lineHeld`](../input/CanvasShortcuts.md#lineheld) is `true`, usually bound to `Shift`, a move drag also carries every visible movement unit nested in the dragged one, as [`UVMap.targetsWithin()`](../uv/UVMap.md#targetswithinrect) lists them. A unit is a stacked or unfolded region, or one slot of a free region. The nested units are taken on pointer-down. Units that only overlap the dragged one stay in place, and so do the regions a peer is dragging.

Nested units move by the same delta as the dragged unit, after it is clamped to the canvas. Changing `lineHeld` mid-drag updates the preview at once; releasing it puts the nested units back. The drop commits through [`UVMap.moveGroup()`](../uv/UVMap.md#movegroupmoves), which records one history step. Resize drags never carry.
