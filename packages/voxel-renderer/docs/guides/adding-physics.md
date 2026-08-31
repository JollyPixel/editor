# Adding physics

Pass a collider factory when constructing `VoxelEngine` or `VoxelRenderer`.
The bundled Rapier implementation accepts an initialized Rapier namespace and
world.

```ts
import Rapier from "@dimforge/rapier3d-compat";
import { VoxelRenderer } from "@jolly-pixel/voxel.renderer";
import {
  RapierVoxelCollider
} from "@jolly-pixel/voxel.renderer/plugins/rapier/index.js";

await Rapier.init();

const rapierWorld = new Rapier.World({
  x: 0,
  y: -9.81,
  z: 0
});

const renderer = actor.addComponentAndGet(VoxelRenderer, {
  collider: (context) => new RapierVoxelCollider({
    api: Rapier,
    world: rapierWorld,
    ...context
  })
});
```

The factory runs once after the block and shape registries have been created.
Chunk colliders are rebuilt with chunk meshes and removed when a chunk becomes
empty, its layer is hidden, or the engine is disposed.

Step the Rapier world from the application's fixed update:

```ts
world.on("beforeFixedUpdate", () => {
  rapierWorld.step();
});
```

Choose each block's collision behavior through its shape. Full cubes use box
collision; slopes and other irregular built-in shapes use triangle meshes.
Set a custom shape's `collisionHint` to `"none"` for decoration or triggers.

The [`VoxelCollider` reference](../api/collision/VoxelCollider.md) documents the
backend-neutral contract. [`RapierVoxelCollider`](../api/collision/RapierVoxelCollider.md)
covers the bundled implementation.
