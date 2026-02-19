# Collision

Optional Rapier3D physics integration. Disabled by default — no Rapier dependency is
required when physics is not needed.

---

## Setup

Pass a `rapier` object to `VoxelRendererOptions` to enable collision shapes:

```ts
import Rapier from "@dimforge/rapier3d-compat";

await Rapier.init();
const rapierWorld = new Rapier.World({ x: 0, y: -9.81, z: 0 });

const vr = actor.addComponentAndGet(VoxelRenderer, {
  rapier: { api: Rapier, world: rapierWorld }
});
```

Colliders are built and updated automatically alongside chunk meshes.

---

## Rapier Interfaces

The library uses structural interfaces to avoid importing the Rapier WASM module at the
module level. Pass the already-initialised Rapier namespace as `api`.

```ts
interface RapierAPI {
  RigidBodyDesc: {
    fixed(): RapierRigidBodyDesc;
  };
  ColliderDesc: {
    cuboid(hx: number, hy: number, hz: number): RapierColliderDesc;
    trimesh(vertices: Float32Array, indices: Uint32Array): RapierColliderDesc;
  };
}

interface RapierWorld {
  createRigidBody(desc: RapierRigidBodyDesc): RapierRigidBody;
  createCollider(desc: RapierColliderDesc, parent?: RapierRigidBody): RapierCollider;
  removeCollider(collider: RapierCollider, wakeUp: boolean): void;
  removeRigidBody(body: RapierRigidBody): void;
}

interface RapierCollider {
  readonly handle: number;
}
```

---

## Collision Strategy

The strategy is chosen per-chunk based on the `collisionHint` of each voxel's shape:

- `"box"` — one 1×1×1 cuboid per solid voxel, parented to a static `RigidBody` at the
  chunk origin. Best for full-cube worlds.
- `"trimesh"` — single trimesh built from the chunk's rendered `THREE.BufferGeometry`.
  Accurate for sloped shapes; may ghost-collide on internal edges.
- `"none"` — block is skipped entirely (triggers, decoration).

If **any** block in a chunk uses `"trimesh"`, the entire chunk gets a single trimesh collider.

---

## VoxelColliderBuilder

Builds Rapier collision shapes for individual `VoxelChunk`s. Managed internally by
`VoxelRenderer`; most users do not need to call this directly.

### VoxelColliderBuilderOptions

```ts
interface VoxelColliderBuilderOptions {
  rapier: RapierAPI;
  world: RapierWorld;
  blockRegistry: BlockRegistry;
  shapeRegistry: BlockShapeRegistry;
}
```

### Methods

#### `buildChunkCollider(chunk: VoxelChunk, geometry: THREE.BufferGeometry | null): RapierCollider | null`

Builds or rebuilds the collider for a chunk. Returns `null` if the chunk contains no
solid voxels. The caller is responsible for removing the existing collider (if any)
before calling this.
