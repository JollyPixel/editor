# Collision

Optional physics integration. It is disabled by default, so no physics dependency
is required when collision is not needed.

`VoxelEngine` knows nothing about any physics backend: it drives the `VoxelCollider`
interface. A [Rapier3D](https://rapier.rs/) implementation ships in
[`plugins/rapier`](#rapiervoxelcollider), and any other backend can be plugged in by
implementing the same interface.

## Setup

Pass a `collider` factory to `VoxelEngineOptions` (a.k.a. `VoxelRendererOptions`):

```ts
import Rapier from "@dimforge/rapier3d-compat";
import { VoxelRenderer } from "@jolly-pixel/voxel.renderer";
import {
  RapierVoxelCollider
} from "@jolly-pixel/voxel.renderer/plugins/rapier/index.js";

await Rapier.init();
const rapierWorld = new Rapier.World({ x: 0, y: -9.81, z: 0 });

const vr = actor.addComponentAndGet(VoxelRenderer, {
  collider: (context) => new RapierVoxelCollider({
    api: Rapier,
    world: rapierWorld,
    ...context
  })
});
```

The factory runs once during construction, after the block and shape registries
exist. `context` carries both and is spread into the options above.

Colliders are built and updated automatically alongside chunk meshes, and released when a
chunk is emptied, its layer hidden, or the engine disposed.

> **Opacity note:** a layer's `opacity` (see [Layer](./Layer.md)) has no effect on
> collision except at `opacity === 0`, which is treated like `visible: false` and removes
> the layer's colliders entirely. A translucent layer (e.g. `opacity: 0.5` glass) is still
> fully solid.

## VoxelCollider

The contract between the engine and any physics backend. No physics handle crosses it: the
engine identifies a chunk by an opaque `key` and implementations do their own bookkeeping.

```ts
interface VoxelCollider {
  /** Replaces anything previously registered under `key`. */
  rebuildChunk(key: string, collision: VoxelChunkCollision): void;
  /** No-op for unknown keys. */
  removeChunk(key: string): void;
  dispose(): void;
}

interface VoxelChunkCollision {
  chunk: VoxelChunk;
  /** Grouped by tileset and cutout mode. Treat string keys as opaque. */
  geometries: ReadonlyMap<string, THREE.BufferGeometry>;
  layerOffset: VoxelCoord;
}

type VoxelColliderFactory = (context: {
  blockRegistry: BlockRegistry;
  shapeRegistry: BlockShapeRegistry;
}) => VoxelCollider;
```

`geometries` follows the renderer's draw groups, split by tileset and cutout mode.
Collider implementations should iterate the values or merge them with
`mergeChunkGeometries()`. The merge returns `null` when there is nothing to collide
with and reports whether the caller owns the result and must dispose it:

```ts
const merged = mergeChunkGeometries(collision.geometries);
if (merged) {
  const { geometry, owned } = merged;
  // ...
  if (owned) {
    geometry.dispose();
  }
}
```

## Collision strategy

The strategy is chosen per-chunk based on the `collisionHint` of each voxel's shape:

- `"box"` — one 1×1×1 cuboid per solid voxel, parented to a static body at the
  chunk origin. Best for full-cube worlds.
- `"trimesh"` — single trimesh built from the chunk's rendered geometry.
  Accurate for sloped shapes; may ghost-collide on internal edges.
- `"none"` — block is skipped entirely (triggers, decoration).

If **any** block in a chunk uses `"trimesh"`, the entire chunk gets a single trimesh
collider, falling back to cuboids when no geometry is available.

## RapierVoxelCollider

The bundled Rapier3D implementation, exported from `plugins/rapier`. It creates one static
`RigidBody` per chunk and parents that chunk's colliders to it, so `removeChunk()` drops
the whole chunk in a single `removeRigidBody()` call.

```ts
interface RapierVoxelColliderOptions {
  /** Rapier3D module (static API). */
  api: RapierAPI;
  /** Rapier3D world instance. */
  world: RapierWorld;
  blockRegistry: BlockRegistry;
  shapeRegistry: BlockShapeRegistry;
}
```

`RapierAPI`, `RapierWorld`, `RapierCollider` and friends are structural interfaces declaring
only the subset used here, so the package never imports the Rapier WASM module. Pass the
already-initialised Rapier namespace; the real types satisfy the shapes without a cast.

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
```
