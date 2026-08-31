# VoxelRenderer

`ActorComponent` that renders a layered voxel world as chunked Three.js meshes.
Each chunk is rebuilt only when its content changes, keeping GPU work proportional to edits rather than world size.

Wraps a [`VoxelEngine`](./VoxelEngine.md) instance, exposed as `vr.engine`, and drives its
lifecycle from `awake`/`update`/`destroy`.

## API

```ts
interface VoxelRendererOptions extends VoxelEngineOptions {
  /**
   * Object whose world position prioritizes chunk rebuilds, usually the
   * camera. Sampled once per update; null leaves engine.focus alone.
   * @default null
   */
  focus?: THREE.Object3D | null;
}

class VoxelRenderer extends ActorComponent {
  readonly engine: VoxelEngine;
  focus: THREE.Object3D | null;

  constructor(
    actor: Actor<any>,
    options?: VoxelRendererOptions
  );
  awake(): void;
  update(deltaTime: number): void;
  destroy(): void;
}
```

The constructor uses `actor.world.logger` unless the options supply another
logger. `awake()` attaches `engine.root` to the actor and initializes the
engine. `update()` advances its rebuild queue. `destroy()` removes the root and
disposes the engine before destroying the component.

Pass `focus` to build chunks near a camera first, and to drive
[`viewDistance`](./VoxelEngine.md#view-distance). Its world position is
converted into the engine root's local space on every update, so a moved actor
needs no extra work.

```ts
const vr = actor.addComponentAndGet(VoxelRenderer, {
  focus: cameraActor.object3D,
  viewDistance: 8
});
```

```ts
import {
  VoxelRenderer,
  loadTilesets
} from "@jolly-pixel/voxel.renderer";

// Pre-load tilesets before constructing VoxelRenderer (no async in lifecycle).
const tilesets = await loadTilesets([
  {
    id: "default",
    src: "tileset.png",
    tileSize: 16
  }
]);

const vr = actor.addComponentAndGet(VoxelRenderer, {
  tilesets,
  layers: ["Ground"],
  blocks: [
    {
      id: 1,
      name: "Grass",
      shapeId: "cube",
      collidable: true,
      faceTextures: {},
      defaultTexture: {
        col: 0,
        row: 0
      }
    }
  ]
});

vr.engine.setVoxel("Ground", {
  position: { x: 0, y: 0, z: 0 },
  blockId: 1
});
```

See [VoxelEngine](./VoxelEngine.md) for `VoxelEngineOptions` (constructor options) and
the full `setVoxel` / layer / object-layer / serialization API.

## Hooks

See [hooks](./hooks.md) for more information.
