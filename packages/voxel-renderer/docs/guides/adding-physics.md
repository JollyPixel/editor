# Adding physics

Pass a collider factory when constructing a `VoxelView`. The bundled Rapier
collider takes an initialized Rapier namespace and world.

```ts
import Rapier from "@dimforge/rapier3d-compat";
import {
  RapierVoxelCollider,
  VoxelDocument,
  VoxelView
} from "@jolly-pixel/voxel.renderer";

await Rapier.init();

const rapierWorld = new Rapier.World({
  x: 0,
  y: -9.81,
  z: 0
});

const document = new VoxelDocument({ layers: ["Ground"] });
const view = new VoxelView(document, {
  collider: (context) => new RapierVoxelCollider({
    api: Rapier,
    world: rapierWorld,
    ...context
  })
});
```

The view calls the factory once, then keeps colliders in step with the chunk
meshes. Hidden layers have no colliders.

Step the Rapier world from your fixed update. With the JollyPixel engine,
listen on the engine `World`, not on `document.world`:

```ts
runtime.world.on("beforeFixedUpdate", () => {
  rapierWorld.step();
});
```

Each block's collision comes from its shape's `collisionHint`: cubes and slabs
use boxes, the other [built-in shapes](../api/blocks/BlockShape.md#built-in-shapes)
use triangle meshes. Set `collidable: false` on a block definition, or
`collisionHint: "none"` on a custom shape, for decoration.

The [`VoxelCollider` reference](../api/collision/VoxelCollider.md) documents the
backend-neutral contract, and
[`RapierVoxelCollider`](../api/collision/RapierVoxelCollider.md) the bundled
implementation.
