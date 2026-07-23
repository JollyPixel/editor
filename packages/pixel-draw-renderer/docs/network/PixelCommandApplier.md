# PixelCommandApplier

## `applyCommandToBuffer`

```ts
function applyCommandToBuffer(buffer: PixelBuffer, cmd: PixelNetworkCommand): void
```

Applies a single network command to a headless [`PixelBuffer`](../buffer/PixelBuffer.md) instance. Used internally by [`PixelSyncServer`](./PixelSyncServer.md) (Node.js, no DOM), and usable standalone for server-side logic, unit tests, or replaying a command log without a renderer.

`"select-edit"` groups its `positions`/`colors` by color and replays each group as a `drawPixels` call, then `copyToMaster()` — unlike `"stroke"`'s single uniform color, a select-tool commit's final pixels can be arbitrary per-position colors (see [buffer/PixelBuffer.md](../buffer/PixelBuffer.md)).

`"uv-region-created"` / `"uv-region-deleted"` / `"uv-region-moved"` are applied via the buffer's `uvRegions.set`/`uvRegions.remove`/`uvRegions.get`+`uvRegions.set` (see [buffer/PixelBuffer.md](../buffer/PixelBuffer.md) and [uv/UVRegionCollection.md](../uv/UVRegionCollection.md)); a move preserves the existing region's `color`, only replacing `rect`. A move/delete for an unknown region id is a no-op.

```ts
import {
  PixelBuffer,
  applyCommandToBuffer
} from "@jolly-pixel/pixel-draw.renderer";

const buffer = new PixelBuffer({ size: { x: 64, y: 32 } });
applyCommandToBuffer(buffer, {
  action: "stroke",
  metadata: {
    color: { r: 0, g: 0, b: 0, a: 255 },
    positions: [{ x: 0, y: 0 }]
  },
  clientId: "seed",
  seq: 1,
  timestamp: Date.now()
});
```
