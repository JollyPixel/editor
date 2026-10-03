# RapierVoxelCollider

A [`VoxelCollider`](./VoxelCollider.md) backed by Rapier3D. The package does
not import Rapier; pass your initialized `@dimforge/rapier3d` (or `-compat`)
namespace and world.

```ts
import Rapier from "@dimforge/rapier3d-compat";
import { RapierVoxelCollider, VoxelView } from "@jolly-pixel/voxel.renderer";

await Rapier.init();
const rapierWorld = new Rapier.World({ x: 0, y: -9.81, z: 0 });

const view = new VoxelView(document, {
  collider: (context) => new RapierVoxelCollider({ api: Rapier, world: rapierWorld, ...context })
});
```

## Options

| Option | Type | Description |
| --- | --- | --- |
| `api` | `RapierAPI` | The Rapier namespace. |
| `world` | `RapierWorld` | The Rapier world colliders are added to. |
| `blockRegistry` | `BlockRegistry` | From the factory context. |
| `shapeRegistry` | `BlockShapeRegistry` | From the factory context. |

`RapierAPI` and `RapierWorld` are structural types covering only what the
collider calls: `RigidBodyDesc.fixed()`, `ColliderDesc.cuboid()`,
`ColliderDesc.trimesh()`, and creating and removing bodies and colliders.

## Behaviour

- One fixed rigid body per chunk cell, placed at the cell's `origin`.
- Blocks with `collidable: false`, or whose shape's `collisionHint` is
  `"none"`, get no collider.
- Full cubes are merged into as few cuboids as possible; a cell filled in
  several layers counts once.
- Other `"box"` shapes, such as slabs, get a cuboid of their own bounds.
- `"trimesh"` shapes share one triangle mesh per cell.
- `removeChunk()` removes the body and its colliders.
