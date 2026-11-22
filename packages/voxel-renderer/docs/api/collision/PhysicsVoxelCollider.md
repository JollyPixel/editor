# PhysicsVoxelCollider

A [`VoxelCollider`](./VoxelCollider.md) that adds one fixed body per chunk cell
to a `@jolly-pixel/physics` world. Only the contract's types are imported, so
any backend works; install `@jolly-pixel/physics`, an optional peer
dependency, to use it.

```ts
import { PhysicsSystem } from "@jolly-pixel/physics/ecs";
import { RapierBackend } from "@jolly-pixel/physics.rapier";
import { PhysicsVoxelCollider, VoxelView } from "@jolly-pixel/voxel.renderer";

const backend = await RapierBackend.load();
const physicsSystem = PhysicsSystem.attach(runtime.world, backend);

const map = runtime.world.createActor("map");
const view = new VoxelView(document, {
  collider: (context) => new PhysicsVoxelCollider({
    world: physicsSystem.ownedBodies(map),
    placement: map.transform.global.matrix,
    ...context
  })
});
```

## Options

```ts
interface PhysicsVoxelColliderOptions {
  world: Pick<PhysicsWorld, "createBody">;
  placement?: Readonly<Matrix4>;
  blockRegistry: BlockRegistry; // from the factory context
  shapeRegistry: BlockShapeRegistry; // from the factory context
}
```

The collider only calls `createBody()` on the world, so a test double needs
nothing else. It attaches `box` and `trimesh` shapes only.

`placement` is the world matrix of the object the chunk meshes hang from, read
once at construction. Without it the bodies stay at the origin while the
meshes move. It defaults to the identity matrix.

## Behaviour

- One fixed body per chunk cell, placed at the cell's `origin` transformed by
  `placement` and turned by its rotation. Collider offsets and trimesh vertices
  are relative to it and scaled by its scale, box sizes by its absolute scale.
- Blocks with `collidable: false`, or whose shape's `collisionHint` is
  `"none"`, get no collider.
- Full cubes are merged into as few boxes as possible; a cell filled in
  several layers counts once.
- Other `"box"` shapes, such as slabs, get a box of their own bounds.
- `"trimesh"` shapes share one triangle mesh per cell.
- `rebuildChunk()` removes the previous body of the key before adding the new
  one; a cell with no collidable block gets no body.
- `removeChunk()` and `dispose()` call `remove()` on the bodies.
