# FillTool

The public surface of `"fill"` mode's paint-bucket tool, reached via [`PixelArtCanvas.tools.fill`](../PixelArtCanvas.md#tools).

```ts
export interface FillTool {
  global: boolean;
}
```

## `global`

Reads or sets whether `"fill"` mode recolors every pixel matching the seed's color anywhere on the canvas (`true`), instead of only the seed's 4-directionally connected region (`false`, the default).

Runtime-only: there is no constructor option. The setting persists across mode switches, mirroring `brush`'s size/color.

> [!IMPORTANT]
> A global fill still commits and undoes as a single atomic edit, but broadcasts over `onBufferUpdated`/the network layer as a compact `"global-fill"` event (`{ fromColor, toColor }`, no position list) instead of `"stroke"`, since it can touch a large fraction of the canvas; see [buffer/PixelBuffer.md](../buffer/PixelBuffer.md). Undoing/redoing a global fill replays as a full-position `"stroke"` event instead.
