# README.md

<h1 align="center">
  Voxel.Renderer
</h1>

<p align="center">
  JollyPixel Voxel Engine and Renderer
</p>

## 📌 About

Chunked voxel engine and Three.js renderer. Use `VoxelEngine` directly, or `VoxelRenderer` to plug it into a JollyPixel [engine][engine] (ECS) scene. Either way you get multi-layer voxel worlds with tileset textures, face culling, block transforms, JSON save/load, and optional physics via a pluggable collider interface (Rapier3D included).

## 💡 Features

- Chunked world (default 16³) — only dirty chunks are rebuilt each frame, the rest are left alone
- Named layers composited top-down; decorative layers override base terrain without Z-fighting
- Toggle visibility, reorder, add/remove layers, and move them in world space
- Face culling between adjacent solid voxels to keep triangle counts low
- Many built-in block shapes (cube, slabs, ramp, corners, pole, stairs) and a `BlockShape` interface for custom geometry
- Per-block transforms via a packed byte — 90° Y rotations and X/Z flips without duplicating definitions
- Multiple tilesets at different resolutions; tiles referenced by `{ tilesetId, col, row }`
- Per-face texture overrides on any block definition
- `"lambert"` (default) or `"standard"` (PBR) material modes
- Configurable `alphaTest` for foliage and sprite-style cutout blocks
- `save()` / `load()` round-trips the full world state as plain JSON
- `TiledConverter` to import Tiled `.tmj` maps in `"stacked"` or `"flat"` layer modes
- Optional physics through the backend-agnostic `VoxelCollider` interface, with `"box"` or `"trimesh"` colliders rebuilt per dirty chunk and a Rapier3D plugin included; zero extra dependency if omitted
- Compatible with JollyPixel engine logger

> [!NOTE]
> The implementation and optimization are probably far from perfect. Feel free to open a PR to help us.

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/voxel.renderer
# or
$ yarn add @jolly-pixel/voxel.renderer
```

## 👀 Usage example

### Basic — place voxels manually

```ts
const blocks: BlockDefinition[] = [
  {
    id: 1,
    name: "Dirt",
    shapeId: "cube",
    collidable: true,
    faceTextures: {
      [Face.PosY]: {
        tilesetId: "default",
        col: 0,
        row: 2
      },
      [Face.NegX]: {
        tilesetId: "default",
        col: 0,
        row: 1
      },
      [Face.NegZ]: {
        tilesetId: "default",
        col: 0,
        row: 1
      },
      [Face.PosX]: {
        tilesetId: "default",
        col: 0,
        row: 1
      },
      [Face.PosZ]: {
        tilesetId: "default",
        col: 0,
        row: 1
      }
    },
    defaultTexture: {
      tilesetId: "default",
      col: 2,
      row: 0
    }
  }
];

const voxelMap = world.createActor("map")
  .addComponentAndGet(VoxelRenderer, {
    chunkSize: 16,
    layers: ["Ground"],
    blocks
  });

voxelMap.engine.loadTileset({
  id: "default",
  src: "tileset/UV_cube.png",
  tileSize: 32
});

// Place a flat 8×8 ground plane
for (let x = 0; x < 8; x++) {
  for (let z = 0; z < 8; z++) {
    voxelMap.engine.setVoxel("Ground", {
      position: { x, y: 0, z },
      blockId: 1
    });
  }
}
```

### Tiled import — convert a `.tmj` map

```ts
import { loadJSON } from "@jolly-pixel/engine";
import {
  VoxelRenderer,
  TiledConverter,
  type TiledMap
} from "@jolly-pixel/voxel.renderer";

// No blocks or layers needed here — load() restores them from the JSON snapshot
const voxelMap = world.createActor("map")
  .addComponentAndGet(VoxelRenderer, { alphaTest: 0.1, material: "lambert" });

const tiledMap = await loadJSON<TiledMap>("tilemap/map.tmj");

const worldJson = new TiledConverter().convert(tiledMap, {
  // Map Tiled .tsx source references to the PNG files served by your dev server
  resolveTilesetSrc: (src) => "tilemap/" + src.replace(/\.tsx$/, ".png"),
  layerMode: "stacked"
});

voxelMap.engine.load(worldJson);

await loadRuntime(runtime);
```

### Rapier3D physics

Physics is plugged in through the backend-agnostic `VoxelCollider` interface

```ts
import Rapier from "@dimforge/rapier3d-compat";
import { RapierVoxelCollider } from "@jolly-pixel/voxel.renderer/plugins/rapier/index.js";

await Rapier.init();
const rapierWorld = new Rapier.World({
  x: 0,
  y: -9.81,
  z: 0
});

// Step physics once per fixed tick, before the scene update
world.on("beforeFixedUpdate", () => rapierWorld.step());

const voxelMap = world.createActor("map")
  .addComponentAndGet(VoxelRenderer, {
    chunkSize: 16,
    layers: ["Ground"],
    blocks,
    collider: (context) => new RapierVoxelCollider({
      api: Rapier,
      world: rapierWorld,
      ...context
    })
  });
```

## 🚀 Running the examples

Four interactive examples live in the `examples/` directory and are served by Vite. Start the dev server from the package root:

```bash
npm run dev -w @jolly-pixel/voxel.renderer
```

Then open one of these URLs in your browser:

| URL | Script | What it shows |
|---|---|---|
| `http://localhost:5173/` | `demo-physics.ts` | A 32×32 voxel terrain with a raised platform and a Rapier3D physics sphere you can roll around with arrow keys |
| `http://localhost:5173/tileset.html` | `demo-tileset.ts` | Every tile in `Tileset001.png` laid out as UV-mapped quads with col/row labels, plus a rotating textured cube |
| `http://localhost:5173/shapes.html` | `demo-shapes.ts` | All 19 built-in block shapes rendered as coloured meshes with a wireframe overlay and labelled name |
| `http://localhost:5173/tiled.html` | `demo-tiled.ts` | A multi-layer Tiled `.tmj` map imported via `TiledConverter` in `"stacked"` mode with WASD camera navigation |

All four examples use OrbitControls (left drag: rotate, right drag: pan, scroll: zoom) except the physics demo which uses `Camera3DControls` (WASD + mouse).

## 📚 API

- [VoxelEngine](docs/VoxelEngine.md) - Engine-agnostic core — options, voxel placement, tileset loading, save/load. Usable standalone or via `VoxelRenderer`.
- [VoxelRenderer](docs/VoxelRenderer.md) - `ActorComponent` wrapper around `VoxelEngine` for JollyPixel scenes.
- [World](docs/World.md) - `VoxelWorld`, `VoxelLayer`, `VoxelChunk`, and related types.
- [Blocks](docs/Blocks.md) - `BlockDefinition`, `BlockShape`, `BlockRegistry`, `BlockShapeRegistry`, and `Face`.
- [Tileset](docs/Tileset.md) - `TilesetManager`, `TilesetDefinition`, `TileRef`, UV regions.
- [Serialization](docs/Serialization.md) - `VoxelSerializer` and JSON snapshot types.
- [Collision](docs/Collision.md) - The `VoxelCollider` contract and the bundled `RapierVoxelCollider` plugin.
- [Built-In Shapes](docs/BuiltInShapes.md) - All built-in block shapes and custom shape authoring.
- [TiledConverter](docs/TiledConverter.md) - Converting Tiled `.tmj` exports to `VoxelWorldJSON`.

## 🔥 Troubleshooting

If something isn't working as expected, enable verbose logging to get detailed runtime output:

```ts
// Enable debug logs for the entire runtime
const { world } = runtime;
world.logger.setLevel("debug");
world.logger.enableNamespace("*");
```

Alternatively, pass a custom `Logger` instance to `VoxelRenderer`:

```ts
import { Systems } from "@jolly-pixel/engine";
import { VoxelRenderer } from "@jolly-pixel/voxel.renderer";

const vr = new VoxelRenderer({
  logger: new Systems.Logger({
    level: "trace",
    namespaces: ["*"]
  })
});
```

Quick tips

- **Tileset missing:** verify the `src` path and ensure the image is being served (check browser Network tab and CORS).
- **Cutout/transparent textures look wrong:** increase or decrease `alphaTest` (for example `alphaTest: 0.1`) to tune cutout thresholds.
- **Physics not working:** make sure Rapier is initialized (`await Rapier.init()`) and that your `collider` factory returns a `RapierVoxelCollider` built with that `World`.
- **Chunks not updating or faces missing:** face culling hides faces between adjacent solid voxels; confirm neighboring voxels are placed correctly.

Reporting issues

- When opening an issue, include package and runtime versions, reproduction steps, and enable debug logs (see above). A minimal repro or screenshot speeds up investigation.

## Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Once you have finished your development, check that the tests (and linter) are still good by running the following script:

```bash
$ npm run test
$ npm run lint
```

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

## License

MIT

<!-- Reference-style links for DRYness -->

[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
[contributing]: ../../CONTRIBUTING.md
[engine]: https://github.com/JollyPixel/editor/tree/main/packages/engine


# Blocks.md

# Blocks

Block definitions, shapes, registries, and the `Face` constant.

## BlockDefinition

Describes a block type: its shape, textures, and physics behaviour.

```ts
/**
 * Describes a block type: its shape, per-face texture tiles, and collidability.
 * Block ID 0 is always air and is never stored in the registry.
 */
export interface BlockDefinition {
  /**
   * Unique numeric identifier.
   * @note
   * 0 is reserved for air.
   **/
  id: number;
  /** Human-readable name for editor display. */
  name: string;
  /** ID of the BlockShape to use for geometry generation. */
  shapeId: BlockShapeID;
  /**
   * Per-face tile references.
   * If a face is absent, defaultTexture is used.
   * Allows blocks to have a different top texture from their sides.
   */
  faceTextures: Partial<Record<FACE, TileRef>>;
  /** Fallback tile used for any face not listed in faceTextures. */
  defaultTexture?: TileRef;
  /**
   * If false, the mesh builder will not emit
   * collision geometry for this block.
   **/
  collidable: boolean;
}
```

## BlockShapeID

```ts
type BlockShapeID =
  | "cube"
  | "slabBottom"
  | "slabTop"
  | "poleY"
  | "pole"
  | "ramp"
  | "rampCornerInner"
  | "rampCornerOuter"
  | "stair"
  | "stairCornerInner"
  | "stairCornerOuter"
  | (string & {}); // custom shapes registered at runtime
```

> The `(string & {})` tail means any string compiles, but unknown IDs fail silently at
> runtime — the voxel is skipped. Always use a built-in ID or one registered via
> `BlockShapeRegistry.register()`.

![Available block shapes](./images/shapes.png)


## BlockCollisionHint

```ts
type BlockCollisionHint = "box" | "trimesh" | "none";
```

- `"box"` — compound cuboids; one per solid voxel. Cheapest; best for full-cube worlds.
- `"trimesh"` — exact triangle mesh built from rendered geometry. Accurate for slopes;
  may ghost-collide on shared edges.
- `"none"` — no collision geometry. Use for decorative or trigger blocks.

See [Collision](./Collision.md) for more information.

## FaceDefinition

Geometry descriptor for one polygonal face of a block shape.

```ts
interface FaceDefinition {
  /** Axis-aligned culling direction used to find the neighbor to check. */
  face: FACE;
  /** Outward-pointing surface normal (need not be axis-aligned). */
  normal: Vec3;
  /** 3 (triangle) or 4 (quad) positions in 0-1 block space. */
  vertices: readonly Vec3[];
  /** Same count as vertices; UV coordinates in 0-1 tile space. */
  uvs: readonly Vec2[];
}
```

A quad is triangulated as `[0,1,2]` + `[0,2,3]`.

## BlockShape

Interface implemented by all shape classes.

```ts
interface BlockShape {
  readonly id: BlockShapeID;
  readonly faces: readonly FaceDefinition[];
  readonly collisionHint: BlockCollisionHint;
  occludes(face: Face): boolean;
}
```

`occludes(face)` returns `true` only when the shape fully covers the given face, allowing
the mesh builder to skip the opposite face on the neighbour. Partial shapes (ramps, wedges)
must return `false` to avoid incorrect face culling.

## BlockRegistry

Maps numeric block IDs to `BlockDefinition` objects. Accessible via `VoxelEngine.blockRegistry`.

#### `register(def: BlockDefinition): this`

Registers a block definition. Throws if `def.id === 0`.

#### `get(id: number): BlockDefinition | undefined`

#### `has(id: number): boolean`

#### `getAll(): IterableIterator<BlockDefinition>`

## BlockShapeRegistry

Maps shape IDs to `BlockShape` implementations. Pre-populated with all built-in shapes
by `VoxelEngine`. Accessible via `VoxelEngine.shapeRegistry`.

#### `register(shape: BlockShape): this`

#### `get(id: BlockShapeID): BlockShape | undefined`

#### `has(id: BlockShapeID): boolean`

#### `static createDefault(): BlockShapeRegistry`

Creates a standalone registry pre-loaded with all built-in shapes.

## Face

Axis-aligned face directions used for culling decisions and per-face texture references.

```ts
const Face = {
  PosX: 0, // +X
  NegX: 1, // -X
  PosY: 2, // +Y (top)
  NegY: 3, // -Y (bottom)
  PosZ: 4, // +Z
  NegZ: 5  // -Z
} as const;

type Face = typeof Face[keyof typeof Face];
```


# BuiltInShapes.md

# Built-In Shapes

All shapes below are registered automatically by `VoxelEngine`. They are also available
standalone via `BlockShapeRegistry.createDefault()`.

## Shape Reference

![Available block shapes](./images/shapes.png)

### Solid / Slab

All shapes in this category use **collisionHint**: [box](./Collision.md).

| Shape ID | Occludes |
|---:|---|
| `cube` | All faces |
| `slabBottom` | `-Y` |
| `slabTop` | `+Y` |

```ts
type SlabType = "top" | "bottom";
```

Passed to the `Slab` constructor to select which half of the block space the slab occupies.
The default is `"bottom"`.

### Poles / Beams

All pole shapes use **collisionHint**: [trimesh](./Collision.md) and occlude no faces (sub-voxel cross-section).

| Shape ID | Occludes |
|---:|---|
| `poleY` | — |
| `pole` | — |

### Ramps

All ramp shapes use **collisionHint**: [trimesh](./Collision.md).

| Shape ID | Occludes |
|---:|---|
| `ramp` | `-Y`, `+Z` |
| `rampCornerInner` | `-Y`, `+Z`, `+X` |
| `rampCornerOuter` | `-Y` |

### Stairs

All stair shapes use **collisionHint**: [trimesh](./Collision.md).

| Shape ID | Occludes |
|---:|---|
| `stair` | `-Y`, `+Z` |
| `stairCornerInner` | `-Y`, `+Z`, `+X` |
| `stairCornerOuter` | `-Y` |

### Inverted / Upside-Down Shapes (`flipY`)

Ceiling ramps, inverted stairs, and similar shapes are produced by setting `flipY: true`
on any voxel rather than using a dedicated shape class. `flipY` mirrors the block geometry
around `y = 0.5`, reverses face winding to preserve correct lighting, and swaps
the `+Y`/`-Y` occlusion directions so face culling against neighbours remains accurate.

```ts
// Ceiling ramp — same geometry as "ramp" but mounted upside-down
engine.setVoxel("Ceiling", {
  position: { x: 2, y: 4, z: 0 },
  blockId: myRampBlock,
  flipY: true
});

// Inverted inner-corner stair
engine.setVoxel("Ceiling", {
  position: { x: 3, y: 4, z: 0 },
  blockId: myStairBlock,
  rotation: VoxelRotation.CW90,
  flipY: true
});
```

`flipY` can be combined freely with `rotation`, `flipX`, and `flipZ`.

---

> You can also learn more about Collision [here](./Collision.md).

## Custom Shapes

Implement `BlockShape` and register the instance via the `shapes` option or `shapeRegistry.register()`:

```ts
import {
  VoxelEngine,
  type BlockShape,
  type FaceDefinition,
  type Face
} from "@jolly-pixel/voxel.renderer";

class MyShape implements BlockShape {
  readonly id = "myShape";
  readonly collisionHint = "box" as const;
  readonly faces: readonly FaceDefinition[] = [
    // define triangles/quads in 0–1 block space
  ];

  occludes(_face: Face): boolean {
    return false; // return true only for fully covered faces
  }
}

// Option A — at construction time
const engine = new VoxelEngine({
  shapes: [
    new MyShape()
  ]
});

// Option B — at any time before voxels are placed
engine.shapeRegistry.register(
  new MyShape()
);
```

Then reference the shape in a `BlockDefinition`:

```ts
engine.blockRegistry.register({
  id: 10,
  name: "Custom",
  shapeId: "myShape",
  collidable: true,
  faceTextures: {},
  defaultTexture: {
    col: 0,
    row: 0
  }
});
```

See [Blocks](./Blocks.md) documentation for more information.


# Chunk.md

# VoxelChunk

Fixed-size, sparse 3D grid of `VoxelEntry` data. Chunk coordinates `(cx, cy, cz)` are in
**chunk space** — multiply by `chunkSize` to get the world-space origin.

## Constructor

```ts
new VoxelChunk(
  [cx, cy, cz]: [number, number, number],
  size?: number
)
```

> [!NOTE]
> Chunk has a default size of 16

## Properties

```ts
class VoxelChunk {
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;

  // side length in voxels
  readonly size: number;

  // set true on any write; cleared by VoxelEngine after mesh rebuild
  dirty: boolean;

  readonly voxelCount: number;
}
```

## Methods

```ts
type VoxelLinearCoords = [number, number, number];
```

### `get(coords: VoxelLinearCoords): VoxelEntry | undefined`

### `set(coords: VoxelLinearCoords, entry: VoxelEntry): void`

### `delete(coords: VoxelLinearCoords): void`

### `isEmpty(): boolean`

### `entries(): IterableIterator<[number, VoxelEntry]>`

Iterates all stored entries as `[linearIndex, VoxelEntry]` pairs.

### `linearIndex(lx: number, ly: number, lz: number): number`

Converts local chunk coordinates to the flat map key used for sparse storage.

### `fromLinearIndex(idx: number): [number, number, number]`

Inverse of `linearIndex`.


# Collision.md

# Collision

Optional physics integration. Disabled by default — no physics dependency is required when
collision is not needed.

`VoxelEngine` knows nothing about any physics backend: it drives the `VoxelCollider`
interface. A [Rapier3D](https://rapier.rs/) implementation ships in
[`plugins/rapier`](#rapiervoxelcollider), and any other backend can be plugged in by
implementing the same interface.

## Setup

Pass a `collider` factory to `VoxelEngineOptions` (a.k.a. `VoxelRendererOptions`):

```ts
import Rapier from "@dimforge/rapier3d-compat";
import { RapierVoxelCollider } from "@jolly-pixel/voxel.renderer/plugins/rapier/index.js";

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

The factory runs once during construction, after the block and shape registries exist —
`context` carries both, spread into the options above.

Colliders are built and updated automatically alongside chunk meshes, and released when a
chunk is emptied, its layer hidden, or the engine disposed.

> **Opacity note** — a layer's `opacity` (see [Layer](./Layer.md)) has no effect on
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
  /** Keyed by tileset id — collision is texture-agnostic. */
  geometries: ReadonlyMap<string, THREE.BufferGeometry>;
  layerOffset: VoxelCoord;
}

type VoxelColliderFactory = (context: {
  blockRegistry: BlockRegistry;
  shapeRegistry: BlockShapeRegistry;
}) => VoxelCollider;
```

`geometries` is split per tileset because rendering needs one draw call per texture.
Implementations needing a single mesh can merge them with `mergeChunkGeometries()`, which
returns `null` when there is nothing to collide with and flags whether the caller owns
(and must dispose) the result:

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

## Collision Strategy

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
already-initialised Rapier namespace — the real types satisfy the shapes without a cast.

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


# Hooks.md

# Hooks

Hooks allow you to listen for changes in `VoxelEngine`, for example when a layer
is added, removed or updated. They are particularly useful for synchronizing voxel-world
changes between multiple clients or systems.

```ts
import {
  VoxelEngine,
  type VoxelLayerHookEvent
} from "@jolly-pixel/voxel-renderer";

function onLayerUpdated(
  event: VoxelLayerHookEvent
): void {
  // Narrow on `action` to get a fully-typed `metadata`.
  if (event.action === "voxel-set") {
    console.log(event.metadata.position, event.metadata.blockId);
  }
}

const engine = new VoxelEngine({
  onLayerUpdated,
});
```

You can also set (or replace) the hook after construction:

```ts
engine.onLayerUpdated = (event) => { /* ... */ };
// Clear the hook:
engine.onLayerUpdated = undefined;
```

When wrapped by `VoxelRenderer`, the same hook lives at `vr.engine.onLayerUpdated`.

## Event reference

`VoxelLayerHookEvent` is a discriminated union keyed on `action`. Narrowing on `action`
gives you a precise `metadata` type with no casting required.

| `action` | `metadata` shape | Notes |
|---|---|---|
| `"added"` | `{ options: VoxelLayerConfigurableOptions }` | |
| `"removed"` | `{}` | |
| `"updated"` | `{ options: Partial<VoxelLayerConfigurableOptions> }` | |
| `"offset-updated"` | `{ offset: VoxelCoord }` or `{ delta: VoxelCoord }` | |
| `"voxel-set"` | `{ position, blockId, rotation, flipX, flipZ, flipY }` | |
| `"voxel-removed"` | `{ position: Vector3Like }` | |
| `"voxels-set"` | `{ entries: VoxelSetOptions[] }` | Bulk placement |
| `"voxels-removed"` | `{ entries: VoxelRemoveOptions[] }` | Bulk removal |
| `"reordered"` | `{ direction: "up" \| "down" }` | |
| `"object-layer-added"` | `{}` | |
| `"object-layer-removed"` | `{}` | |
| `"object-layer-updated"` | `{ patch: { visible?: boolean } }` | |
| `"object-added"` | `{ object: VoxelObjectJSON }` | Full object, not just ID |
| `"object-removed"` | `{ objectId: string }` | |
| `"object-updated"` | `{ objectId: string; patch: Partial<VoxelObjectJSON> }` | |

`VoxelLayerHookAction` is a convenience alias for `VoxelLayerHookEvent["action"]`.

## Breaking change: `"object-added"` metadata

Prior to the network sync layer, the `"object-added"` event carried `{ objectId: string }`.
It now carries `{ object: VoxelObjectJSON }` so remote commands can fully reconstruct the
object without an extra lookup. Update existing consumers:

```ts
// Before
if (event.action === "object-added") {
  console.log(event.metadata.objectId);
}

// After
if (event.action === "object-added") {
  console.log(event.metadata.object.id); // same value, richer payload
}
```


# Layer.md

# VoxelLayer

A named, ordered collection of `VoxelChunk`s. Returned by `VoxelWorld.addLayer()`.

## VoxelLayerOptions

```ts
interface VoxelLayerConfigurableOptions {
  /**
   * Whether the layer is visible by default.
   * @default true
   */
  visible?: boolean;
  /**
   * Rendered translucency, from `0` (fully transparent) to `1` (fully opaque).
   * Values are clamped to `[0, 1]`.
   * @default 1
   */
  opacity?: number;
  /**
   * Arbitrary layer properties.
   * @default {}
   */
  properties?: Record<string, any>;
}

interface VoxelLayerOptions extends VoxelLayerConfigurableOptions {
  /** Unique layer identifier. */
  id: string;
  /** Human-readable layer name. */
  name: string;
  /**
   * Draw order;
   * higher values render above lower ones.
   **/
  order: number;
  /** Size of one voxel chunk (required). */
  chunkSize: number;
  /**
   * World-space offset applied to voxels.
   * @default { x: 0, y: 0, z: 0 }
   **/
  offset?: VoxelCoord;
}
```

## Properties

```ts
class VoxelLayer {
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly visible: boolean;
  readonly opacity: number;
  wasVisible: boolean;

  // number of currently allocated chunks
  readonly chunkCount: number;

  // world-space translation applied to every voxel in the layer
  offset: VoxelCoord;
  properties: Record<string, any>;
}
```

> **Offset semantics** — `offset` shifts where voxels appear in world space without
> changing the underlying chunk storage. A voxel set at local position `{0,0,0}` renders
> at `{offset.x, offset.y, offset.z}`. Use `VoxelWorld.setLayerOffset` or
> `translateLayer` (preferred) so all dependent chunks are marked dirty automatically.

> **Opacity semantics** — `opacity` is baked per-vertex into the layer's mesh (real alpha
> blending), and also drives occlusion: a layer with `opacity < 1` (e.g. glass) never
> hides the faces of neighbouring voxels, in any layer, the way a fully opaque layer does.
> `opacity === 0` is treated exactly like `visible = false` — the layer stops winning
> world compositing (`VoxelWorld.getVoxelAt`) and its chunk meshes/colliders are removed.
> Partial opacity (`0 < opacity < 1`) does **not** affect collision — a translucent layer
> is still solid. Use `VoxelWorld.setLayerOpacity` or `updateLayer(name, { opacity })`
> so dependent chunks are marked dirty automatically.


## Methods

### toJSON(): VoxelLayerJSON

Layer as a serializable JSON

```ts
interface VoxelLayerJSON {
  id: string;
  name: string;
  visible: boolean;
  opacity?: number;
  order: number;
  offset?: { x: number; y: number; z: number; };
  properties?: Record<string, any>;
  voxels: Record<VoxelEntryKey, VoxelEntryJSON>;
}
```

> [!NOTE]
> Used under the hood by the `VoxelSerializer` implementation, see: [Serialization](./Serialization.md)

### getOrCreateChunk(cx: number, cy: number, cz: number): VoxelChunk

Returns the `VoxelChunk` at the given chunk coordinates, creating it if it does not exist.

```ts
const chunk = layer.getOrCreateChunk(0, 0, 0);
```

### getChunk(cx: number, cy: number, cz: number): VoxelChunk | undefined

Returns the `VoxelChunk` at the given chunk coordinates, or `undefined` if none exists.

```ts
const chunk = layer.getChunk(1, 0, -2);
if (!chunk) {}
```

### getVoxelAt(position: Vector3Like): VoxelEntry | undefined

Read a voxel at world-space `position` (offset is applied).
Returns the `VoxelEntry` or `undefined` if empty.

```ts
const entry = layer.getVoxelAt({ x: 10, y: 5, z: 0 });
```

### setVoxelAt(position: Vector3Like, entry: VoxelEntry): void

Set a voxel at world-space `position`. Allocates a chunk if necessary and marks it dirty for rebuild.

```ts
layer.setVoxelAt({ x: 0, y: 0, z: 0 }, { blockId: 3, transform: 0 });
```

### removeVoxelAt(position: Vector3Like): void

Remove the voxel at the given world-space `position`. If the containing chunk becomes empty it is freed.

```ts
layer.removeVoxelAt({ x: 0, y: 0, z: 0 });
```

### centerToWorld(): Vector3

Returns the world-space center of all voxels in the given layer, accounting for the layer offset.
When the layer has no voxels the layer offset itself is returned as a Vector3.

### markChunkDirty(cx: number, cy: number, cz: number): void

Mark the chunk at the given chunk coordinates as dirty so it will be rebuilt.

```ts
layer.markChunkDirty(0, 0, 0);
```

### getChunks(): IterableIterator< VoxelChunk >

Iterate allocated chunks in this layer.

```ts
for (const chunk of layer.getChunks()) {
  // process chunk
}
```


# Network.md

# Network Sync Layer

The network sync layer adds **server-authoritative multiplayer** on top of `VoxelEngine`, built directly on `@jolly-pixel/network`'s primitives (`network.Server` / `network.Extension` / `network.Client` / `network.Room`). Multiple clients share the same voxel world in real time: `VoxelSyncClient` extends `network.SyncAdapter` to wire a `VoxelEngine` instance (standalone or via `vr.engine`) to a `network.Room`, and `VoxelSyncServer` is a `network.Extension` that owns the authoritative `VoxelWorld`.

This mirrors `@jolly-pixel/pixel-draw.renderer`'s network layer (`PixelSyncClient`/`PixelSyncServer`) — both packages share the same wire discipline and dev-server wiring pattern.

## Architecture overview

```
┌─────────────┐   local mutation   ┌───────────────────┐   send(cmd)     ┌─────────────────┐
│ VoxelEngine │──────────────────▶│  VoxelSyncClient  │────────────────▶│  network.Room   │
│  (headless) │                   │                   │◀────────────────│(network.Client) │
│             │◀──applyRemote──── │                   │   onMessage     │                 │
└─────────────┘                   └───────────────────┘                 └────────┬────────┘
                                                                                  │  wire (ws)
                                                                                  ▼
                                                                     ┌─────────────────────┐
                                                                     │    network.Server   │
                                                                     │   (room router)     │
                                                                     └──────────┬──────────┘
                                                                                │ register()
                                                                                ▼
                                                                     ┌─────────────────────┐
                                                                     │  VoxelSyncServer    │
                                                                     │(network.Extension)  │
                                                                     │  headless, owns     │
                                                                     │  VoxelWorld)        │
                                                                     └─────────────────────┘
```

**Flow:**
1. A local mutation (e.g. `setVoxel`) fires the `onLayerUpdated` hook.
2. `VoxelSyncClient` chains onto the hook, stamps the command with `clientId` / `seq` / `timestamp`, and calls `room.send(cmd)`.
3. `network.Client` forwards it over one shared WebSocket, tagged with the client's room.
4. `network.Server` routes it to the registered `VoxelSyncServer` instance for that room, which validates the command (LWW conflict resolution), applies it to its authoritative `VoxelWorld`, and broadcasts it to every client joined to that room.
5. Each client's room handle dispatches a `"message"` event with `{ type: "command", data: cmd }`, which `VoxelSyncClient` routes to `engine.applyRemoteCommand(cmd)` (skipping its own echoed commands by `clientId`).
6. `applyRemoteCommand` sets an internal flag so that the resulting hook event is **not** re-emitted — preventing infinite echo loops.

## Client setup

```ts
import * as network from "@jolly-pixel/network";
import {
  VoxelSyncClient,
  type VoxelNetworkCommand,
  type VoxelServerMessage
} from "@jolly-pixel/voxel.renderer";

const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
const client = new network.Client({ url: `${wsProtocol}//${location.host}/ws-sync` });
const room = client.room<VoxelNetworkCommand, VoxelServerMessage>("voxel-map:world");

const syncClient = new VoxelSyncClient({ room });
syncClient.attach(vr.engine); // or a standalone, headless VoxelEngine
```

`attach()` **chains** onto any existing `engine.onLayerUpdated` handler instead of replacing it — a handler set at `VoxelEngine`/`VoxelRenderer` construction time keeps firing. `detach()` restores whatever handler was present before `attach()` was called.

### Lifecycle

```ts
// When the sync client is no longer needed:
syncClient.destroy(); // detach() + removes its "message" listener + room.leave()
```

## Server setup — Vite dev server

`VoxelSyncServer` is a `network.Extension`, registered onto a `network.Server` via `@jolly-pixel/network`'s `createWebSocketNetworkPlugin` Vite plugin — the same pattern `pixel-draw-renderer` uses. A single `vite dev` process then serves both the static app and the WebSocket sync endpoint:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { createWebSocketNetworkPlugin } from "@jolly-pixel/network/plugins/vite.ts";
import { VoxelSyncServer } from "@jolly-pixel/voxel.renderer";

export default defineConfig({
  plugins: [
    createWebSocketNetworkPlugin({
      extensions: [
        // Must match the client's room above.
        new VoxelSyncServer({ id: "voxel-map:world" })
      ]
    })
  ]
});
```

Multiple `VoxelSyncServer` instances (one per world) can be registered side by side, each under its own room — and alongside a `PixelSyncServer` for texture sync, since both extend the same `network.Extension` base and share one `network.Server`/WebSocket.

> **Pre-seed the server's world to match the client's initial state.** A client typically creates a default layer locally (e.g. `VoxelEngine`'s `layers` constructor option) before its `VoxelSyncClient` has attached — that layer is never sent to the server. If the server starts with an empty `VoxelWorld`, the *first* snapshot it sends back will have zero layers, and `engine.load()` on the client wipes its local default layer out to match. Pass a pre-populated `world` (with the same layer name(s) the client bootstraps) so every client's first snapshot is already consistent — the same reason `PixelSyncServer` is typically constructed with a pre-sized `PixelBuffer` rather than a blank one:
> ```ts
> const world = new VoxelWorld(16);
> world.addLayer("Ground");
> new VoxelSyncServer({ id: "voxel-map:world", world });
> ```
>
> `receive()` never lets a bad command crash the server: applying a command that references a layer the server doesn't know about (e.g. a stale command from before a reconnect) is caught, logged, and dropped instead of propagating the underlying `VoxelWorld` exception (`setVoxelAt`/`removeVoxelAt` etc. throw by design for local/programmatic misuse, which would otherwise take down the shared session for every connected client over one bad command).

### API

| Method | Description |
|--------|-------------|
| `onClientConnect(client)` | Sends the current snapshot to a newly joined client (called by `network.Server`). |
| `onClientDisconnect(clientId)` | No-op — `network.Server` owns membership bookkeeping. |
| `onMessage(clientId, payload, context)` | Validates and routes an incoming payload to `receive()`. |
| `getEventName(payload)` | Returns the command's `action` (or `"unknown"` for a non-`VoxelNetworkCommand` payload) — used by `network.ServerRoom` to look up rights when the server was constructed with one (see [Rights (RBAC)](#rights-rbac)). |
| `name` | Always `"voxel.renderer"`, shared by every `VoxelSyncServer` instance regardless of `id` — the namespace a rights table keys its rules against (e.g. `"voxel.renderer.*"`). |
| `events` | The full `VoxelLayerHookAction` vocabulary (`"voxel-set"`, `"object-added"`, ...) — a declarative catalog for whoever configures the server's rights table; `VoxelSyncServer` itself never decides who may use them. |
| `receive(cmd, context)` | Validates, applies, and broadcasts a command via `context.room.broadcast()` (useful in tests). |
| `snapshot()` | Returns the current world as `VoxelWorldJSON`. |
| `world` | The authoritative `VoxelWorld` instance. |

`context: network.RoomContext` is handed in per call by `network.ServerRoom` — it's not stashed anywhere, so `VoxelSyncServer` never holds broadcast capability outside of reacting to an actual client event. A server-driven push with no triggering client event (a timer, an admin action) goes through `network.Server.broadcast(roomId, payload)` instead.

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `string` | `"voxel-map"` | `network.Extension` id this server is registered under. |
| `world` | `VoxelWorld` | new world | Existing world to use as authoritative state. |
| `chunkSize` | `number` | `16` | Chunk size when creating a new world. |
| `conflictResolver` | `network.ConflictResolver<VoxelNetworkCommand>` | `network.LastWriteWinsResolver` | Custom conflict strategy. |

## Rights (RBAC)

`VoxelSyncServer` never defines roles or a rights policy itself — it only exposes its type identity via `name` (always `"voxel.renderer"`) and its action vocabulary via `events`/`getEventName()`. The rights table (which role can do what) is entirely a `network.Server` concern, configured once wherever the server is actually wired up (e.g. `vite.config.ts`, alongside `createWebSocketNetworkPlugin`), and keyed by `name` rather than by each world's `id` — one rule set covers every `VoxelSyncServer` world registered on that server:

```ts
createWebSocketNetworkPlugin({
  extensions: [
    new VoxelSyncServer({ id: "voxel-map:world-1", world }),
    new VoxelSyncServer({ id: "voxel-map:world-2" }) // same rights apply here too
  ],
  rights: {
    viewer: {
      "voxel.renderer.$join": "write",       // viewers may join...
      "voxel.renderer.$presence": "write",   //  ...and share cursor/presence...
      "voxel.renderer.voxel-set": "read",    //  ...and see edits...
      "voxel.renderer.voxel-removed": "read",
      "voxel.renderer.object-added": "read"
      // any action not listed here fails open to "write" for "viewer" too —
      // list every mutating action you actually want to restrict, or use a
      // trailing "voxel.renderer.*" to catch everything not already matched.
    },
    editor: {
      "voxel.renderer.$join": "write" // everything else falls through to the fail-open default (full write)
    }
  }
});
```

A client with no `role` in its join `identity`, or a role that isn't a key in the table, falls open to full write access — matching `@jolly-pixel/network`'s "unrestricted by default" behavior (see [Rights](../../network/docs/Rights.md)). Role assignment here is **not authenticated** — `identity.role` is whatever the client sent at `room.join()`. If real access control is needed, resolve the role from a trusted session/auth layer before constructing that `identity` client-side.

## VoxelNetworkCommand — wire format

A `VoxelNetworkCommand` is a `VoxelLayerHookEvent` extended with `@jolly-pixel/network`'s routing header:

```ts
type VoxelNetworkCommand = VoxelLayerHookEvent & network.NetworkCommandHeader;
// network.NetworkCommandHeader = {
//   clientId: string;   // originating client ID
//   seq: number;        // monotonically increasing per client
//   timestamp: number;  // Unix ms (Date.now()) at time of mutation
// }
```

Commands and snapshots are wrapped in a `VoxelServerMessage` envelope delivered via `network.Room`'s `"message"` event:

```ts
type VoxelServerMessage = network.NetworkServerMessage<VoxelNetworkCommand, VoxelWorldJSON>;
```

Both `NetworkCommandHeader` and `NetworkServerMessage` live in `@jolly-pixel/network`, shared verbatim with `pixel-draw-renderer`'s `PixelNetworkCommand`/`PixelServerMessage` — see [`SyncAdapter`](../../network/docs/sync/SyncAdapter.md).

## Conflict resolution

### Default: network.LastWriteWinsResolver

The default resolver uses **timestamp** to determine which command wins at a given voxel
position. On a tie, the lexicographically greater `clientId` wins (deterministic without
coordination). Commands from the *same* `clientId` as the last accepted one always win,
regardless of timestamp ordering — this is what keeps replayed operations (e.g. an undo/redo
system built on top of `VoxelEngine`) from being rejected as stale by their own historical
timestamp. See [Conflicts](../../network/docs/sync/Conflicts.md) for the full
rationale — the resolver is shared verbatim with `pixel-draw-renderer`.

```ts
import * as network from "@jolly-pixel/network";

const server = new VoxelSyncServer({
  conflictResolver: new network.LastWriteWinsResolver() // default, no need to pass explicitly
});
```

### Custom resolver

Implement `network.ConflictResolver<VoxelNetworkCommand>` for custom strategies (e.g. first-write-wins, priority by
role, etc.):

```ts
import type * as network from "@jolly-pixel/network";
import type { VoxelNetworkCommand } from "@jolly-pixel/voxel.renderer";

class FirstWriteWinsResolver implements network.ConflictResolver<VoxelNetworkCommand> {
  resolve({ existing }: network.ConflictContext<VoxelNetworkCommand>): "accept" | "reject" {
    // Accept only if no prior command exists at this position
    return existing ? "reject" : "accept";
  }
}

const server = new VoxelSyncServer({ conflictResolver: new FirstWriteWinsResolver() });
```

> **Note:** Conflict resolution only applies to per-position voxel operations (`"voxel-set"`,
> `"voxel-removed"`). Structural layer operations (`"added"`, `"removed"`, `"reordered"`, etc.)
> are always accepted.

## VoxelCommandApplier — headless usage

`applyCommandToWorld` lets you replay hook events against a bare `VoxelWorld` without a
renderer. Useful for server-side logic, unit tests, or offline editing tools.

```ts
import { VoxelWorld, applyCommandToWorld } from "@jolly-pixel/voxel.renderer";

const world = new VoxelWorld(16);
applyCommandToWorld(world, {
  action: "added",
  layerName: "Ground",
  metadata: { options: {} }
});
applyCommandToWorld(world, {
  action: "voxel-set",
  layerName: "Ground",
  metadata: {
    position: { x: 0, y: 0, z: 0 },
    blockId: 1,
    rotation: 0,
    flipX: false,
    flipZ: false,
    flipY: false
  }
});
```


# Serialization.md

# Serialization

Save and restore world state as plain JSON. Version 1 stores voxels as a sparse map
keyed by `"x,y,z"` strings for human readability and easy diffing.
Tileset metadata is embedded so the loader can restore textures automatically.

```ts
const engine = new VoxelEngine({});

// Save
const json = engine.save();
localStorage.setItem("map", JSON.stringify(json));

// Load
const data = JSON.parse(localStorage.getItem("map")!) as VoxelWorldJSON;
engine.load(data);
```

## Types

```ts
/** World-space coordinate encoded as a string key. */
type VoxelEntryKey = `${number},${number},${number}`;

interface VoxelEntryJSON {
  block: number;     // BlockDefinition.id
  transform: number; // packed rotation + flip byte
}

interface VoxelLayerJSON {
  id: string;
  name: string;
  visible: boolean;
  order: number;
  /** World-space translation of the layer.
   * Absent in files produced before layer offsets were introduced;
   * treated as {x:0,y:0,z:0} on load.
   **/
  offset?: { x: number; y: number; z: number };
  voxels: Record<VoxelEntryKey, VoxelEntryJSON>;
}

/**
 * Voxel keys are always world-space coordinates (layer offset included).
 * Files produced before layer offsets were introduced carry no `offset` field
 * and are loaded as if offset is {0,0,0} — identical to the previous behaviour.
 */

/**
 * Flat key/value bag for custom object properties.
 * Only primitive scalars (string, number, boolean) survive the round-trip.
 */
type VoxelObjectProperties = Record<string, string | number | boolean>;

/**
 * A single named object placed in the world (spawn point, trigger zone, …).
 * Coordinates are in voxel/tile space; floats are allowed for sub-tile precision.
 * `y` is 0 for maps imported from a flat 2-D source.
 */
interface VoxelObjectJSON {
  id: string;
  name: string;
  /** Optional semantic type tag (e.g. "SpawnPoint", "Trigger"). */
  type?: string;
  x: number;
  y: number;
  z: number;
  width?: number;
  height?: number;
  rotation?: number;
  visible: boolean;
  properties?: VoxelObjectProperties;
}

/** A named layer that holds placed objects rather than voxel data. */
interface VoxelObjectLayerJSON {
  id: string;
  name: string;
  visible: boolean;
  order: number;
  objects: VoxelObjectJSON[];
}

interface VoxelWorldJSON {
  version: 1;
  chunkSize: number;
  tilesets: TilesetDefinition[];
  layers: VoxelLayerJSON[];
  /** Block definitions embedded by converters (e.g. TiledConverter).
   * Auto-registered on load.
   **/
  blocks?: BlockDefinition[];
  /**
   * Named object layers (spawn points, triggers, etc.).
   * Present in converter output and in files saved after object layers
   * were added at runtime via VoxelEngine.addObjectLayer().
   */
  objectLayers?: VoxelObjectLayerJSON[];
}
```

## VoxelSerializer

Low-level serialiser. Most users should prefer the higher-level `VoxelEngine.save()` /
`VoxelEngine.load()`, which also handle material invalidation and chunk rebuilds.

#### `serialize(world: VoxelWorld, tilesetManager: TilesetManager): VoxelWorldJSON`

Converts the world and tileset metadata to a plain JSON-serialisable object.

#### `deserialize(data: VoxelWorldJSON, world: VoxelWorld): void`

Clears `world` and restores it from a snapshot. Voxel layers and object layers are
both restored. Throws if `data.version !== 1`.


# TiledConverter.md

# TiledConverter

Converts a Tiled JSON map (`TiledMap`) to `VoxelWorldJSON` for import via `VoxelEngine.load()`.

- Tile layers become voxel layers.
- Object layers become `VoxelObjectLayerJSON` entries with pixel-to-voxel coordinate conversion.
- Group layers are flattened recursively.

Block definitions derived from the tileset are embedded in `result.blocks` so they are
auto-registered when passed to `VoxelEngine.load()`.

```ts
import { loadJSON } from "@jolly-pixel/engine";
import {
  TiledConverter,
  VoxelEngine,
  type TiledMap
} from "@jolly-pixel/voxel.renderer";

const tiledMap = loadJSON<TiledMap>("map.tmj");

const engine = new VoxelEngine({});
engine.load(
  new TiledConverter().convert(tiledMap, {
    resolveTilesetSrc: (_src, tilesetId) => `assets/${tilesetId}.png`,
    layerMode: "stacked"
  })
);
```

> [!IMPORTANT]
> Infinite maps and compressed tile data are not supported.

## TiledConverterOptions

```ts
interface TiledConverterOptions {
  /**
   * Maps a Tiled tileset `source` string (e.g. `"TX Tileset Grass.tsx"`) and
   * its derived ID to the actual asset path/URL used for TilesetDefinition.src.
   * Called once per tileset. For embedded tilesets without a source file,
   * `tiledSource` is an empty string and `tilesetId` is the tileset name.
   */
  resolveTilesetSrc: (tiledSource: string, tilesetId: string) => string;

  /**
   * Chunk size written into the VoxelWorldJSON output.
   * @default 16
   */
  chunkSize?: number;

  /**
   * Controls how Tiled tile layers map to the 3-D Y axis.
   *
   * - `"flat"`    — all tile layers are placed at Y=0; when two layers occupy
   *                 the same (x, z) cell the later layer wins.
   * - `"stacked"` — tile layer at index N is placed at Y=N (useful for
   *                 multi-floor or multi-depth maps).
   *
   * @default "flat"
   */
  layerMode?: "flat" | "stacked";

  /**
   * BlockShape ID assigned to every generated block.
   * @default "fullCube"
   */
  defaultShapeId?: BlockShapeID;

  /**
   * Whether generated blocks are collidable.
   * @default true
   */
  collidable?: boolean;
}
```

## TiledConverter

### Methods

#### `convert(map: TiledMap, options: TiledConverterOptions): VoxelWorldJSON`

Converts the Tiled map to a `VoxelWorldJSON` object ready to pass to `VoxelEngine.load()`.

## TiledMap

TypeScript types for the Tiled JSON Map Format 1.11.x. Import `TiledMap` when you need to
type the raw JSON before converting:

```ts
import type { TiledMap } from "@jolly-pixel/voxel.renderer";
```

## Example

You can also build this with an ActorComponent and `loadVoxelTiledMap` (which use the Asset system of JollyPixel).

```ts
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import {
  loadVoxelTiledMap,
  VoxelRenderer
} from "@jolly-pixel/voxel.renderer";

export class VoxelBehavior extends ActorComponent {
  world = loadVoxelTiledMap("map.tmj", {
    layerMode: "stacked"
  });
  voxelRenderer: VoxelRenderer;

  constructor(
    actor: Actor
  ) {
    super({
      actor,
      typeName: "VoxelBehavior"
    });
  }

  awake() {
    const world = this.world.get();

    const vr = this.actor.getComponent(VoxelRenderer);
    if (!vr) {
      throw new Error("VoxelRenderer component not found on actor");
    }
    this.voxelRenderer = vr;
    this.voxelRenderer.engine.load(world);
  }
}
```


# Tileset.md

# Tileset

Tileset loading, UV computation, and pixel-art texture management.
`NearestFilter` and `SRGBColorSpace` are applied automatically to preserve pixel-art crispness.

```ts
// Pre-load tilesets using TilesetLoader, then pass the loader to VoxelRenderer.
const loader = new TilesetLoader();
await loader.fromTileDefinition({
  id: "default",
  src: "assets/tileset.png",
  tileSize: 16
  // cols and rows are optional — derived from the image at load time
});

const vr = actor.addComponentAndGet(VoxelRenderer, { tilesetLoader: loader });

// Tile at column 2, row 0 — uses the default tileset
const tileRef: TileRef = {
  col: 2,
  row: 0
};

// Tile from a secondary tileset
const decorTile: TileRef = {
  col: 0,
  row: 3,
  tilesetId: "decor"
};
```

## TilesetDefinition

Describes an atlas image.

```ts
interface TilesetDefinition {
  id: string;
  src: string;
  /** Tile width/height in pixels (tiles are square) */
  tileSize: number;
  /**
   * Number of tile columns in the atlas.
   * When omitted, derived automatically from the image width
   */
  cols?: number;
  /**
   * Number of tile rows in the atlas.
   * When omitted, derived automatically from the image height
   */
  rows?: number;
}
```

## TileRef

References a specific tile in an atlas by grid position.

```ts
interface TileRef {
  col: number;
  row: number;
  // omit to use the default (first loaded) tileset
  tilesetId?: string;
}
```

## TilesetUVRegion

Precomputed UV atlas region returned by `TilesetManager.getTileUV()`.

```ts
/**
 * Precomputed UV region for a specific tile in the atlas. 
 **/
export interface TilesetUVRegion {
  offsetU: number;
  offsetV: number;
  scaleU: number;
  scaleV: number;
}
```

## TilesetManager

Manages tileset textures and UV lookup. Accessible via `VoxelEngine.tilesetManager` (`vr.engine.tilesetManager`).

### Properties

```ts
readonly defaultTilesetId: string | null; // ID of the first registered tileset
```

### Methods

#### `loadTileset(def: TilesetDefinition, loader?: THREE.TextureLoader): Promise<void>`

Loads an atlas image. The first loaded tileset becomes the default.
A `THREE.TextureLoader` is created internally if `loader` is omitted.

#### `registerTexture(def: TilesetDefinition, texture: THREE.Texture): void`

Registers an already-loaded `THREE.Texture`. Useful in tests or server-side contexts.
Auto-derives `cols` and `rows` from the image dimensions if they are not set on `def`.

#### `getTileUV(ref: TileRef): TilesetUVRegion`

Computes atlas UV coordinates for the tile at `(col, row)`.
Throws if no tileset is loaded or the referenced ID is unknown.

#### `getTexture(tilesetId?: string): THREE.Texture | undefined`

Returns the shared texture for a tileset. Defaults to `defaultTilesetId`.

#### `getDefinitions(): Array<TilesetDefinition & { cols: number; rows: number }>`

Returns all registered tileset definitions with `cols` and `rows` resolved from the image.

#### `getDefaultBlocks(tilesetId: string | null, options?: TilesetDefaultBlockOptions): BlockDefinition[]`

Returns a default Array of `BlockDefinition` mapped to the given **tilesetId** (or default one if not provided).

```ts
interface TilesetDefaultBlockOptions {
  /**
   * Maximum block ID to generate (inclusive).
   * @default 255.
   **/
  limit?: number;
  /**
   * Function to map block IDs to custom block definitions.
   */
  map?: (blockId: number, col: number, row: number) => Omit<BlockDefinition, "id">;
}
```

#### `dispose(): void`

Disposes all textures and materials and clears the registry.

## TilesetLoader

Pre-loading utility that fetches tileset textures asynchronously before a `VoxelRenderer`
(or a standalone `VoxelEngine`) is constructed. Pass the populated loader via
`VoxelEngineOptions.tilesetLoader` so all
textures register synchronously during construction — no async code is needed inside
lifecycle methods (`awake`, `start`, `update`).

### TilesetLoaderOptions

```ts
interface TilesetLoaderOptions {
  /**
   * Optional THREE.LoadingManager to track load progress.
   */
  manager?: THREE.LoadingManager;
  /**
   * Custom loader implementation. For testing only.
   */
  loader?: { loadAsync(url: string): Promise<THREE.Texture<HTMLImageElement>> };
}
```

### Properties

```ts
readonly tilesets: Map<string, TilesetEntry>;
```

Map from tileset ID to `{ def: TilesetDefinition, texture: THREE.Texture<HTMLImageElement> }`.
Populated by `fromTileDefinition` and `fromWorld`.

### Methods

#### `fromTileDefinition(def: TilesetDefinition): Promise<void>`

Loads the atlas image at `def.src` and stores the result in `tilesets`. Idempotent —
calling with the same `def.id` a second time is a no-op (the loader is not invoked again).

#### `fromWorld(data: VoxelWorldJSON): Promise<void>`

Iterates `data.tilesets` and calls `fromTileDefinition` for each. Useful when restoring a
saved world before constructing `VoxelRenderer`.

### Usage examples

**Single tileset:**

```ts
const loader = new TilesetLoader();
await loader.fromTileDefinition({ id: "default", src: "tileset.png", tileSize: 16 });

const vr = actor.addComponentAndGet(VoxelRenderer, { tilesetLoader: loader });
```

**Restoring a saved world (multi-tileset):**

```ts
const snapshot = JSON.parse(localStorage.getItem("world")!);

const loader = new TilesetLoader({ manager: assetManager.context.manager });
await loader.fromWorld(snapshot);                           // pre-load every tileset
await loader.fromTileDefinition(defaultTilesetDef);        // idempotent if already loaded

const vr = actor.addComponentAndGet(VoxelRenderer, { tilesetLoader: loader });
vr.engine.load(snapshot);                                  // fully synchronous
```


# VoxelEngine.md

# VoxelEngine

Voxel world engine: manages layers, blocks, tilesets, and hooks, and builds chunked
Three.js meshes. Use it directly, or through [`VoxelRenderer`](./VoxelRenderer.md),
which exposes it as `vr.engine`.

```ts
const loader = new TilesetLoader();
await loader.fromTileDefinition({
  id: "default",
  src: "tileset.png",
  tileSize: 16
});

const engine = new VoxelEngine({
  tilesetLoader: loader,
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

engine.setVoxel("Ground", {
  position: { x: 0, y: 0, z: 0 },
  blockId: 1
});

engine.setVoxel("Ground", {
  position: { x: 1, y: 0, z: 0 },
  blockId: 1,
  rotation: VoxelRotation.CW90,
  flipX: false,
  flipZ: false
});

engine.setVoxel("Ground", {
  position: { x: 2, y: 0, z: 0 },
  blockId: 1,
  flipY: true
});

const entry = engine.getVoxel({
  x: 0, y: 0, z: 0
});

// Move an entire layer in world space
// e.g. snap a prefab layer to a new grid position
engine.setLayerOffset("Ground", {
  x: 8, y: 0, z: 0
});

// Shift a layer incrementally
engine.translateLayer("Ground", {
  x: 0, y: 1, z: 0
});
```

When wrapped by [`VoxelRenderer`](./VoxelRenderer.md), call the same methods via
`vr.engine.<method>(...)`.

## VoxelEngineOptions (a.k.a. VoxelRendererOptions)

```ts
type MaterialCustomizerFn = (
  material: THREE.MeshLambertMaterial | THREE.MeshStandardMaterial,
  tilesetId: string
) => void;

interface VoxelEngineOptions {
  /**
   * @default 16
   */
  chunkSize?: number;
  /**
   * Enables collision when provided, disabled by default so no physics backend
   * is required. Called once during construction with the registries.
   * See plugins/rapier for the bundled Rapier3D implementation.
   */
  collider?: VoxelColliderFactory;
  /**
   * @default "lambert"
   * The type of material to use for rendering chunks. "standard" supports
   * roughness and metalness maps but is more expensive to render; "lambert"
   * is faster but only supports a simple diffuse map.
   */
  material?: "lambert" | "standard";

  /**
   * Optional callback to customize each material after it is created.
   * Called with the material instance and the tileset ID it corresponds to
   */
  materialCustomizer?: MaterialCustomizerFn;

  /**
   * Optional list of layer names to create on initialization.
   */
  layers?: string[];
  /**
   * Optional initial block definitions to register.
   * Block ID 0 is reserved for air
   */
  blocks?: BlockDefinition[];
  /**
   * Optional block shapes to register in addition to the default
   * shapes provided by BlockShapeRegistry.createDefault().
   */
  shapes?: BlockShape[];
  /**
   * Alpha value below which fragments are discarded (cutout transparency).
   * Set to 0 to disable alpha testing entirely (useful when your tileset tiles
   * have no transparency, or during debugging to confirm geometry is present).
   * @default 0.1
   */
  alphaTest?: number;

  /**
   * Optional logger instance for debug output. Structural type (`child()` +
   * `debug()`) so `Systems.Logger` satisfies it without an import.
   * Defaults to a no-op logger.
   */
  logger?: VoxelLogger;

  /**
   * Optional callback that is called whenever a layer is
   * - added
   * - removed
   * - updated.
   * Useful for synchronizing external systems with changes to the voxel world.
   */
  onLayerUpdated?: VoxelLayerHookListener;

  /**
   * Optional pre-loaded tileset collection. All tilesets in the loader are
   * registered synchronously during construction. Use `TilesetLoader.fromTileDefinition()`
   * or `TilesetLoader.fromWorld()` to populate it before constructing `VoxelEngine`.
   */
  tilesetLoader?: TilesetLoader;
}
```

## Properties

```ts
class VoxelEngine {
  readonly root: THREE.Group; // container for all chunk meshes
  readonly world: VoxelWorld;
  readonly blockRegistry: BlockRegistry;
  readonly shapeRegistry: BlockShapeRegistry;
  readonly tilesetManager: TilesetManager;
  readonly serializer: VoxelSerializer;
}
```

## Lifecycle

```ts
init(): void;                   // builds meshes for any voxels already present (e.g. after deserialize)
tick(deltaTime: number): void;  // rebuilds dirty chunks; call once per frame
dispose(): void;                // disposes chunk meshes, materials, and tileset textures
```

When wrapped by `VoxelRenderer`, these are called automatically from its
`awake()`/`update()`/`destroy()`. Call them yourself when using `VoxelEngine` standalone.

## Methods

#### `getLayer(name: string): VoxelLayer`

Find a layer or `null` if none is found with **name**.

#### `addLayer(name: string, options?: VoxelLayerConfigurableOptions): VoxelLayer`

Creates and returns a new named layer.

options is described by the following interface:
```ts
interface VoxelLayerConfigurableOptions {
  visible?: boolean;
  /**
   * Rendered translucency, from `0` (fully transparent) to `1` (fully opaque).
   * @default 1
   */
  opacity?: number;
  properties?: Record<string, any>;
}
```

> A layer with `opacity < 1` renders with real alpha blending and stops occluding
> neighbouring faces (like glass); `opacity === 0` behaves exactly like `visible: false`.
> See [Layer](./Layer.md) for the full semantics. Partial opacity does not affect
> collision — see [Collision](./Collision.md).

#### `updateLayer(name: string, options?: Partial< VoxelLayerConfigurableOptions >): boolean`

Update a layer that already exists. Return `false` if no layer is found with the given name and `true` when updated.

#### `removeLayer(name: string): VoxelLayer`

Remove and returns a boolean confirming layer deletion.

#### `setLayerOffset(name: string, offset: VoxelCoord): void`

Sets the world-space translation of a layer. All voxels in the layer shift to
`localPosition + offset`. Triggers a full dirty-chunk pass so cross-layer face culling
is re-evaluated on the next frame. No-op if the layer is not found.

#### `translateLayer(name: string, delta: VoxelCoord): void`

Adds `delta` to the layer's current offset. Equivalent to `setLayerOffset` with
`layer.offset + delta`. No-op if the layer is not found.

#### `moveLayer(name: string, direction: "up" | "down"): void`

Swaps `order` with the neighbouring layer in the given direction.

#### `getLayerCenter(name: string): Vector3 | null`

Returns the world-space center of all voxels in the given layer

#### `setVoxel(layerName: string, options: VoxelSetOptions): void`

Places a voxel at a world-space position.

```ts
interface VoxelSetOptions {
  position: THREE.Vector3Like;
  blockId: number;
  /** Y-axis rotation in 90° steps. Default: `VoxelRotation.None`. */
  rotation?: VoxelRotation;
  /** Mirror the block on the X axis. Default: `false`. */
  flipX?: boolean;
  /** Mirror the block on the Z axis. Default: `false`. */
  flipZ?: boolean;
  /** Mirror the block geometry around y = 0.5 (upside-down). */
  flipY?: boolean;
}
```

Y-axis rotation applied to a placed voxel, in 90° steps.

```ts
const VoxelRotation = {
  None:   0, // 0°
  CCW90:  1, // 90° counter-clockwise
  Deg180: 2, // 180°
  CW90:   3, // 90° clockwise
} as const;

type VoxelRotation = typeof VoxelRotation[keyof typeof VoxelRotation];
```

#### `removeVoxel(layerName: string, options: VoxelRemoveOptions): void`

Removes the voxel at a world-space position.

```ts
interface VoxelRemoveOptions {
  position: THREE.Vector3Like;
}
```

#### `setVoxelBulk(layerName: string, entries: VoxelSetOptions[]): void`

Places multiple voxels in the specified layer in a single batch call.

```ts
engine.setVoxelBulk("Ground", [
  { position: { x: 0, y: 0, z: 0 }, blockId: 1 },
  { position: { x: 1, y: 0, z: 0 }, blockId: 2, rotation: VoxelRotation.CW90 },
]);
```

Each item in `entries` accepts the same fields as `VoxelSetOptions`.

#### `removeVoxelBulk(layerName: string, entries: VoxelRemoveOptions[]): void`

Removes multiple voxels from the specified layer in a single batch call.

```ts
engine.removeVoxelBulk("Ground", [
  { position: { x: 0, y: 0, z: 0 } },
  { position: { x: 1, y: 0, z: 0 } },
]);
```

#### `getVoxel` overloads

```ts
getVoxel(position: VoxelCoord): VoxelEntry | undefined
getVoxel(layerName: string, position: VoxelCoord): VoxelEntry | undefined
```

Composited read (first overload) or layer-specific read (second overload). Returns `undefined` for air.

#### `getVoxelNeighbour` overloads

```ts
getVoxelNeighbour(position: VoxelCoord, face: Face): VoxelEntry | undefined
getVoxelNeighbour(layerName: string, position: VoxelCoord, face: Face): VoxelEntry | undefined
```

Returns the voxel immediately adjacent to `position` in the given face direction.
Composited (first overload) or restricted to a specific layer (second overload).

#### `loadTileset(def: TilesetDefinition, texture: THREE.Texture<HTMLImageElement>): void`

Registers an already-loaded texture for a tileset definition. The first registered tileset
becomes the default for `TileRef` values with no explicit `tilesetId`.
Prefer passing a `TilesetLoader` via `VoxelEngineOptions.tilesetLoader` for pre-loading;
use this method only when adding a tileset after construction.

#### `save(): VoxelWorldJSON`

Serialises the full world state (layers, voxels, tileset metadata) to a plain JSON object.

#### `load(data: VoxelWorldJSON): void`

Clears the current world and restores state from a JSON snapshot. All tilesets referenced
by the snapshot must have been pre-loaded via `TilesetLoader` before this call — if a
tileset is missing, an error is thrown. Already-registered tilesets are skipped.

#### `markAllChunksDirty(source?: string): void`

Mark all the chunks as dirty and rebuild them in the next frame

### Object Layer API

Object layers hold placed objects (spawn points, trigger zones, etc.) rather than voxel
data. Each mutating method fires a `VoxelLayerHookEvent` so external systems stay in sync.

#### `addObjectLayer(name: string, options?: { visible?: boolean; order?: number }): VoxelObjectLayerJSON`

Creates a new object layer in the world and fires `"object-layer-added"`.
Returns the new layer descriptor.

#### `removeObjectLayer(name: string): boolean`

Removes an object layer from the world. Fires `"object-layer-removed"` on success.
Returns `false` if not found.

#### `getObjectLayer(name: string): VoxelObjectLayerJSON | undefined`

Returns the layer descriptor for `name`, or `undefined` if it does not exist.

#### `getObjectLayers(): readonly VoxelObjectLayerJSON[]`

Returns a snapshot array of all object layers in insertion order.

#### `updateObjectLayer(name: string, patch: { visible?: boolean }): boolean`

Applies a partial patch to a named object layer and fires `"object-layer-updated"`.
Returns `false` if not found.

#### `addObject(layerName: string, object: VoxelObjectJSON): boolean`

Appends an object to the named layer and fires `"object-added"`.
Returns `false` if the layer does not exist.

#### `removeObject(layerName: string, objectId: string): boolean`

Removes the object with the given `id` from the layer and fires `"object-removed"`.
Returns `false` if the layer or object is not found.

#### `updateObject(layerName: string, objectId: string, patch: Partial<VoxelObjectJSON>): boolean`

Merges `patch` into the matching object and fires `"object-updated"`.
Returns `false` if the layer or object is not found.

### Hooks

See [Hooks](./Hooks.md) for more information


# VoxelRenderer.md

# VoxelRenderer

`ActorComponent` that renders a layered voxel world as chunked Three.js meshes.
Each chunk is rebuilt only when its content changes, keeping GPU work proportional to edits rather than world size.

Wraps a [`VoxelEngine`](./VoxelEngine.md) instance, exposed as `vr.engine`, and drives its
lifecycle from `awake`/`update`/`destroy`.

```ts
// Pre-load tilesets before constructing VoxelRenderer (no async in lifecycle).
const loader = new TilesetLoader();
await loader.fromTileDefinition({
  id: "default",
  src: "tileset.png",
  tileSize: 16
});

const vr = actor.addComponentAndGet(VoxelRenderer, {
  tilesetLoader: loader,
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

### Hooks

See [Hooks](./Hooks.md) for more information


# World.md

# World

Data model for the voxel world: layers, chunks, and per-voxel entries.

Under the hood world use:
- [Chunk](./Chunk.md)
- [Layer](./Layer.md)

## Types

```ts
/**
 * World-space integer position.
 * Any `THREE.Vector3Like` is accepted wherever `VoxelCoord` is expected.
 **/
interface VoxelCoord {
  x: number;
  y: number;
  z: number;
}

interface VoxelEntry {
  // references BlockDefinition.id;
  // 0 = air (never stored)
  blockId: number;
  // packed rotation + flip flags
  transform: number;
}
```

## VoxelWorld

Top-level container for a layered voxel scene. Layers are composited from highest `order`
to lowest — the first visible layer with `opacity > 0` that has a voxel at a given position
wins. This allows decorative layers to override base terrain non-destructively.
A layer with `opacity === 0` is skipped during compositing exactly like an invisible one.

### Constructor

```ts
new VoxelWorld(chunkSize?: number) // default: 16
```

### Properties

```ts
readonly chunkSize: number;
```

### Methods

#### `addLayer(name: string): VoxelLayer`

Creates and appends a new layer with the next available `order`.

#### `removeLayer(name: string): boolean`

Removes a layer by name. Returns `false` if not found.

#### `moveLayer(name: string, direction: "up" | "down"): void`

Swaps `order` with the neighbouring layer in the given direction.

#### `setLayerVisible(name: string, visible: boolean): void`

Hidden layers are skipped during compositing and mesh rebuild.

#### `setLayerOpacity(name: string, opacity: number): void`

Sets a layer's rendered translucency (clamped to `[0, 1]`). A layer with `opacity < 1`
stops occluding neighbouring faces during mesh building (like glass); `opacity === 0`
is treated exactly like `visible = false`. Marks only the layer's own chunks dirty for a
same-bucket change (e.g. `0.4 → 0.6`), or every layer's chunks when the change crosses the
`opacity === 1` occlusion boundary. No-op if the layer is not found.

#### `setLayerOffset(name: string, offset: VoxelCoord): void`

Sets the world-space translation of a layer. All voxels in that layer are shifted by
`offset` — a voxel stored at local `{0,0,0}` will appear at `{offset.x, offset.y, offset.z}`
in world space. Marks all chunks in every layer dirty so cross-layer face culling is
re-evaluated on the next frame. No-op if the layer is not found.

#### `translateLayer(name: string, delta: VoxelCoord): void`

Adds `delta` to the layer's current offset. Equivalent to calling `setLayerOffset` with
`layer.offset + delta`. Marks all chunks dirty. No-op if the layer is not found.

#### `getLayer(name: string): VoxelLayer | undefined`

#### `getLayers(): readonly VoxelLayer[]`

All layers, sorted highest `order` first.

#### `getVoxelAt(position: VoxelCoord): VoxelEntry | undefined`

Composited read — returns the voxel from the highest-priority visible layer (`opacity > 0`)
at that position. Returns `undefined` for air.

#### `getVoxelWithLayerAt(position: VoxelCoord): { entry: VoxelEntry; layer: VoxelLayer } | undefined`

Same compositing rules as `getVoxelAt`, but also returns the owning `VoxelLayer` so callers
can inspect layer-level properties (e.g. `opacity`) of the resolved voxel.

#### `getVoxelNeighbour(position: VoxelCoord, face: Face): VoxelEntry | undefined`

Composited read of the voxel immediately adjacent to `position` in the given face direction.

#### `setVoxelAt(layerName: string, position: VoxelCoord, entry: VoxelEntry): void`

Writes a voxel directly and marks neighbouring chunks dirty for boundary face re-evaluation.
Throws if the layer is not found. Prefer `VoxelEngine.setVoxel` to handle rotation packing.

#### `removeVoxelAt(layerName: string, position: VoxelCoord): void`

Removes a voxel. No-op if the layer is not found.

#### `getAllChunks(): Generator<[VoxelLayer, VoxelChunk]>`

Iterates over every chunk across all layers.

#### `getAllDirtyChunks(): Generator<[VoxelLayer, VoxelChunk]>`

Iterates over chunks whose `dirty` flag is set.

#### `clear(): void`

Removes all voxel layers and object layers.

### Object Layer Management

Object layers hold placed objects (spawn points, trigger zones, etc.) rather than
voxel data. They are stored by name and serialised as part of `VoxelWorldJSON`.

#### `addObjectLayer(name: string, options?: { visible?: boolean; order?: number }): VoxelObjectLayerJSON`

Creates a new object layer. `order` defaults to the current layer count (appended last).
Returns the new layer descriptor.

#### `removeObjectLayer(name: string): boolean`

Deletes an object layer by name. Returns `false` if not found.

#### `getObjectLayer(name: string): VoxelObjectLayerJSON | undefined`

Returns the layer descriptor for `name`, or `undefined` if it does not exist.

#### `getObjectLayers(): readonly VoxelObjectLayerJSON[]`

Returns a snapshot array of all object layers in insertion order.

#### `updateObjectLayer(name: string, patch: { visible?: boolean }): boolean`

Applies a partial patch to a named object layer. Returns `false` if not found.

#### `addObjectToLayer(layerName: string, object: VoxelObjectJSON): boolean`

Appends an object to the named layer's `objects` array. Returns `false` if the layer
does not exist.

#### `removeObjectFromLayer(layerName: string, objectId: string): boolean`

Removes the object with the given `id` from the layer. Returns `false` if the layer or
object is not found.

#### `updateObjectInLayer(layerName: string, objectId: string, patch: Partial<VoxelObjectJSON>): boolean`

Merges `patch` into the matching object. Returns `false` if the layer or object is not
found.
