# PixelCommandApplier

## `applyCommandToWorld`

```ts
function applyCommandToWorld(world: PixelWorld, cmd: PixelNetworkCommand): void
```

Applies a single network command to a headless [`PixelWorld`](./PixelWorld.md) instance. Used internally by [`PixelSyncServer`](./PixelSyncServer.md) (Node.js, no DOM), and usable standalone for server-side logic, unit tests, or replaying a command log without a renderer.

`"uv-region-created"` / `"uv-region-deleted"` / `"uv-region-moved"` are applied via the target buffer's `uvRegions.set`/`uvRegions.remove`/`uvRegions.get`+`uvRegions.set` (see [buffer/PixelBuffer.md](../buffer/PixelBuffer.md) and [uv/UVRegionCollection.md](../uv/UVRegionCollection.md)); a move preserves the existing region's `color`, only replacing `rect`. All three are no-ops for an unknown buffer (or, for a move, an unknown region id).

```ts
import {
  PixelWorld,
  applyCommandToWorld
} from "@jolly-pixel/pixel-draw.renderer";

const world = new PixelWorld();
applyCommandToWorld(world, {
  action: "buffer-added",
  bufferId: "tileset-1",
  metadata: { size: { x: 64, y: 32 } },
  clientId: "seed",
  seq: 1,
  timestamp: Date.now()
});
```
