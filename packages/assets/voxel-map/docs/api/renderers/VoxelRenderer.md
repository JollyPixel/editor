# VoxelRenderer

`VoxelRenderer` adapts `VoxelEngine` to the JollyPixel actor-component
lifecycle. It attaches the engine root and initializes it during `awake()`,
ticks the engine during `update()`, and removes and disposes it during
`destroy()`.

```ts
import { VoxelRenderer } from "@jolly-pixel/asset.voxel-map/renderers/index.ts";

const renderer = actor.addComponentAndGet(VoxelRenderer, {
  focus: cameraActor.object3D,
  tilesets,
  blocks,
  layers: ["Ground"]
});

renderer.engine.world.setVoxel("Ground", {
  position: { x: 0, y: 0, z: 0 },
  blockId: 1
});
```

## API

```ts
interface VoxelRendererOptions extends VoxelEngineOptions {
  focus?: THREE.Object3D | null;
}

class VoxelRenderer extends ActorComponent {
  readonly engine: VoxelEngine;
  focus: THREE.Object3D | null;

  constructor(actor: Actor<any>, options?: VoxelRendererOptions);
  awake(): void;
  update(deltaTime: number): void;
  destroy(): void;
}
```

The actor world's logger is used unless `options.logger` is supplied. When a
focus object is set, its world position is converted to engine-root local
coordinates on every update before the engine ticks.
