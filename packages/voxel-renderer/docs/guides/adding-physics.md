# Adding physics

Pass a collider factory when constructing `VoxelEngine`.
The bundled Rapier implementation accepts an initialized Rapier namespace and
world.

```ts
import Rapier from "@dimforge/rapier3d-compat";
import {
  RapierVoxelCollider,
  VoxelEngine
} from "@jolly-pixel/voxel.renderer";

await Rapier.init();

const rapierWorld = new Rapier.World({
  x: 0,
  y: -9.81,
  z: 0
});

const engine = new VoxelEngine({
  collider: (context) => new RapierVoxelCollider({
    api: Rapier,
    world: rapierWorld,
    ...context
  })
});
```

The factory runs once after the block and shape registries have been created.
Chunk colliders are rebuilt with chunk meshes, one per chunk cell shared by the
layers drawn there, and removed when no layer draws in the cell any more, the
layers are hidden, or the engine is disposed.

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
