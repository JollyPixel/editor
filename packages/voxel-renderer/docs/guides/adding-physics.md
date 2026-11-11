# Adding physics

Pass a collider factory when constructing a `VoxelView`. The bundled
[`PhysicsVoxelCollider`](../api/collision/PhysicsVoxelCollider.md) adds the
voxels to a `@jolly-pixel/physics` world; `@jolly-pixel/physics.rapier`
provides one backed by Rapier.

```ts
import { PhysicsSystem } from "@jolly-pixel/physics/engine";
import { RapierBackend } from "@jolly-pixel/physics.rapier";
import {
  PhysicsVoxelCollider,
  VoxelDocument,
  VoxelView
} from "@jolly-pixel/voxel.renderer";

const backend = await RapierBackend.load();
const physicsSystem = PhysicsSystem.attach(runtime.world, backend);

const map = runtime.world.createActor("map");
const document = new VoxelDocument({ layers: ["Ground"] });
const view = new VoxelView(document, {
  collider: (context) => new PhysicsVoxelCollider({
    world: physicsSystem.ownedBodies(map),
    ...context
  })
});
```

`ownedBodies(map)` makes ray hits and contacts on the terrain name the `map`
actor; `physicsSystem.physics` also works, with no actor. The view calls the
factory once, then keeps colliders in step with the chunk meshes. Hidden
layers have no colliders. The `PhysicsSystem` steps the world
on every fixed update of the engine `World`; without the engine, call
`world.step(seconds)` from your own fixed update.

Each block's collision comes from its shape's `collisionHint`: cubes and slabs
use boxes, the other [built-in shapes](../api/blocks/BlockShape.md#built-in-shapes)
use triangle meshes. Set `collidable: false` on a block definition, or
`collisionHint: "none"` on a custom shape, for decoration.

In a scene file, set `collision: true` on the `VoxelMap` component and give
[`VoxelMapDefinition`](../api/engine/VoxelMapDefinition.md#collision) a
`collider` option; the world still needs its `PhysicsSystem` before the scene
loads.

The [`VoxelCollider` reference](../api/collision/VoxelCollider.md) documents the
contract for writing a collider of your own.
