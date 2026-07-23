# FillTool

Paint-bucket tool for `"fill"` mode, reached via [`PixelArtCanvas.tools.fill`](../PixelArtCanvas.md#tools).

```ts
export interface FillTool {
  global: boolean;
}
```

## `global`

- `false` (default): floods the 4-connected region from the seed pixel.
- `true`: recolors every matching pixel on the canvas.

Runtime-only: no constructor option. Persists across mode switches.

> [!IMPORTANT]
> A global fill commits as a single atomic edit and broadcasts a compact `"global-fill"` event (`{ fromColor, toColor }`) instead of `"stroke"`. Undo/redo replays it as a full `"stroke"`.
