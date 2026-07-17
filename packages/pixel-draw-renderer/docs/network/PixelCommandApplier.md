# PixelCommandApplier

## `applyCommandToWorld`

```ts
function applyCommandToWorld(world: PixelWorld, cmd: PixelNetworkCommand): void
```

Applies a single network command to a headless [`PixelWorld`](./PixelWorld.md) instance. Used internally by [`PixelSyncServer`](./PixelSyncServer.md) (Node.js, no DOM), and usable standalone for server-side logic, unit tests, or replaying a command log without a renderer.

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
