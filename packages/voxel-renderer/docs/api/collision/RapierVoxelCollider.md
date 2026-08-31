# RapierVoxelCollider

`RapierVoxelCollider` implements `VoxelCollider` with Rapier3D. It is exported
from `@jolly-pixel/voxel.renderer/plugins/rapier/index.js`.

## API

```ts
interface RapierVoxelColliderOptions {
  api: RapierAPI;
  world: RapierWorld;
  blockRegistry: BlockRegistry;
  shapeRegistry: BlockShapeRegistry;
}

class RapierVoxelCollider implements VoxelCollider {
  constructor(options: RapierVoxelColliderOptions);

  rebuildChunk(
    key: string,
    collision: VoxelChunkCollision
  ): void;
  removeChunk(key: string): void;
  dispose(): void;
}
```

The implementation creates one fixed rigid body per chunk. Removing a chunk
removes that body and its attached colliders.

`RapierAPI`, `RapierWorld`, and the other Rapier types are structural interfaces
for the subset used by this package. Voxel-renderer never imports the Rapier
WASM module. Pass the initialized Rapier namespace and world instance.

```ts
interface RapierAPI {
  RigidBodyDesc: {
    fixed(): RapierRigidBodyDesc;
  };
  ColliderDesc: {
    cuboid(
      hx: number,
      hy: number,
      hz: number
    ): RapierColliderDesc;
    trimesh(
      vertices: Float32Array,
      indices: Uint32Array
    ): RapierColliderDesc;
  };
}

interface RapierWorld {
  createRigidBody(
    descriptor: RapierRigidBodyDesc
  ): RapierRigidBody;
  createCollider(
    descriptor: RapierColliderDesc,
    parent?: RapierRigidBody
  ): RapierCollider;
  removeCollider(
    collider: RapierCollider,
    wakeUp: boolean
  ): void;
  removeRigidBody(body: RapierRigidBody): void;
}
```
