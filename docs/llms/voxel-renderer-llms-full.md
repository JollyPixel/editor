# README.md

<h1 align="center">
  Voxel.Renderer
</h1>

<p align="center">
  JollyPixel Voxel Engine and Renderer
</p>

## 📌 About

Chunked voxel engine and renderer for Three.js and the JollyPixel [engine][engine] (ECS). Add `VoxelRenderer` to any scene and you get multi-layer voxel worlds with tileset textures, face culling, block transforms, JSON save/load, and optional Rapier3D physics.

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
- Optional Rapier3D physics with `"box"` or `"trimesh"` colliders rebuilt per dirty chunk; zero extra dependency if omitted

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

voxelMap.loadTileset({
  id: "default",
  src: "tileset/UV_cube.png",
  tileSize: 32
}).catch(console.error);

// Place a flat 8×8 ground plane
for (let x = 0; x < 8; x++) {
  for (let z = 0; z < 8; z++) {
    voxelMap.setVoxel("Ground", {
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

voxelMap.load(worldJson).catch(console.error);

await loadRuntime(runtime);
```

### Rapier3D physics

```ts
import Rapier from "@dimforge/rapier3d-compat";

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
    rapier: { api: Rapier, world: rapierWorld }
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

- [VoxelRenderer](docs/VoxelRenderer.md) - Main `ActorComponent` — options, voxel placement, tileset loading, save/load.
- [World](docs/World.md) - `VoxelWorld`, `VoxelLayer`, `VoxelChunk`, and related types.
- [Blocks](docs/Blocks.md) - `BlockDefinition`, `BlockShape`, `BlockRegistry`, `BlockShapeRegistry`, and `Face`.
- [Tileset](docs/Tileset.md) - `TilesetManager`, `TilesetDefinition`, `TileRef`, UV regions.
- [Serialization](docs/Serialization.md) - `VoxelSerializer` and JSON snapshot types.
- [Collision](docs/Collision.md) - Rapier3D integration, `VoxelColliderBuilder`, and physics interfaces.
- [Built-In Shapes](docs/BuiltInShapes.md) - All built-in block shapes and custom shape authoring.
- [TiledConverter](docs/TiledConverter.md) - Converting Tiled `.tmj` exports to `VoxelWorldJSON`.

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

---

## BlockDefinition

Describes a block type: its shape, textures, and physics behaviour.

```ts
interface BlockDefinition {
  id: number;                                    // Unique ID — 0 is reserved for air
  name: string;                                  // Display name
  shapeId: BlockShapeID;
  faceTextures: Partial<Record<Face, TileRef>>;  // Per-face texture overrides
  defaultTexture?: TileRef;                      // Fallback for faces not in faceTextures
  collidable: boolean;                           // false = no collision geometry emitted
}
```

---

## BlockShapeID

```ts
type BlockShapeID =
  | "cube"
  | "slabBottom"
  | "slabTop"
  | "poleY"
  | "poleX"
  | "poleZ"
  | "poleCross"
  | "ramp"
  | "rampFlip"
  | "rampCornerInner"
  | "rampCornerOuter"
  | "rampCornerInnerFlip"
  | "rampCornerOuterFlip"
  | "stair"
  | "stairCornerInner"
  | "stairCornerOuter"
  | "stairFlip"
  | "stairCornerInnerFlip"
  | "stairCornerOuterFlip"
  | (string & {}); // custom shapes registered at runtime
```

> The `(string & {})` tail means any string compiles, but unknown IDs fail silently at
> runtime — the voxel is skipped. Always use a built-in ID or one registered via
> `BlockShapeRegistry.register()`.

![Available block shapes](./shapes.png)

---

## BlockCollisionHint

```ts
type BlockCollisionHint = "box" | "trimesh" | "none";
```

- `"box"` — compound cuboids; one per solid voxel. Cheapest; best for full-cube worlds.
- `"trimesh"` — exact triangle mesh built from rendered geometry. Accurate for slopes;
  may ghost-collide on shared edges.
- `"none"` — no collision geometry. Use for decorative or trigger blocks.

---

## FaceDefinition

Geometry descriptor for one polygonal face of a block shape.

```ts
interface FaceDefinition {
  face: Face;                // Culling direction — which neighbour to check
  normal: Vec3;              // Outward normal (need not be axis-aligned)
  vertices: readonly Vec3[]; // 3 (triangle) or 4 (quad) positions in 0–1 block space
  uvs: readonly Vec2[];      // Same count as vertices, in 0–1 tile space
}
```

A quad is triangulated as `[0,1,2]` + `[0,2,3]`.

---

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

---

## BlockRegistry

Maps numeric block IDs to `BlockDefinition` objects. Accessible via `VoxelRenderer.blockRegistry`.

#### `register(def: BlockDefinition): this`

Registers a block definition. Throws if `def.id === 0`.

#### `get(id: number): BlockDefinition | undefined`

#### `has(id: number): boolean`

#### `getAll(): IterableIterator<BlockDefinition>`

---

## BlockShapeRegistry

Maps shape IDs to `BlockShape` implementations. Pre-populated with all built-in shapes
by `VoxelRenderer`. Accessible via `VoxelRenderer.shapeRegistry`.

#### `register(shape: BlockShape): this`

#### `get(id: BlockShapeID): BlockShape | undefined`

#### `has(id: BlockShapeID): boolean`

#### `static createDefault(): BlockShapeRegistry`

Creates a standalone registry pre-loaded with all built-in shapes.

---

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

All shapes below are registered automatically by `VoxelRenderer`. They are also available
standalone via `BlockShapeRegistry.createDefault()`.

---

## Shape Reference

![Available block shapes](./shapes.png)

### Solid / Slab

- **`Cube`** — `shapeId: "cube"`, `collisionHint: "box"`.
  Standard 1×1×1 cube. Occludes all 6 faces.

- **`Slab`** — `shapeId: "slabBottom"`, `collisionHint: "box"`.
  Half-height slab occupying the bottom half (`y = 0–0.5`). Occludes `-Y` only.

- **`Slab`** — `shapeId: "slabTop"`, `collisionHint: "box"`.
  Half-height slab occupying the top half (`y = 0.5–1`). Occludes `+Y` only.

### Poles / Beams

All pole shapes use `collisionHint: "trimesh"` and occlude no faces (sub-voxel cross-section).

- **`PoleY`** — `shapeId: "poleY"`.
  Narrow vertical post (3/8–5/8 cross-section) running the full block height.

- **`Pole`** — `shapeId: "poleX"`.
  Narrow horizontal beam running along the X axis (full width, centered on Y/Z).

- **`Pole`** — `shapeId: "poleZ"`.
  Narrow horizontal beam running along the Z axis (full depth, centered on X/Y).

- **`PoleCross`** — `shapeId: "poleCross"`.
  Horizontal plus-connector at mid-height — X and Z beams merged at the centre.
  Internal intersection faces are omitted to avoid overdraw.

### Ramps

All ramp shapes use `collisionHint: "trimesh"`.

- **`Ramp`** — `shapeId: "ramp"`.
  Slope rising from `y = 0` at `-Z` to `y = 1` at `+Z`. Occludes `-Y` and `+Z`.

- **`RampFlip`** — `shapeId: "rampFlip"`.
  Y-flipped ramp: full height at `+Z`, ridge at `y = 1` along `-Z`. Occludes `+Y`, `-Y`, and `+Z`.

- **`RampCornerInner`** — `shapeId: "rampCornerInner"`.
  Concave inner corner where two ramps meet. Full walls at `+Z` and `+X`; diagonal slope toward
  the corner. Occludes `-Y`, `+Z`, and `+X`.

- **`RampCornerOuter`** — `shapeId: "rampCornerOuter"`.
  Convex outer corner (quarter-pyramid). Peaks at `(x=0, z=1)`. Occludes `-Y` only.

- **`RampCornerInnerFlip`** — `shapeId: "rampCornerInnerFlip"`.
  Y-flipped `RampCornerInner` — hangs from the ceiling. Occludes `+Y`, `+Z`, and `+X`.

- **`RampCornerOuterFlip`** — `shapeId: "rampCornerOuterFlip"`.
  Y-flipped `RampCornerOuter` — quarter-pyramid hanging from the ceiling. Occludes `+Y` only.

### Stairs

All stair shapes use `collisionHint: "trimesh"`.

- **`Stair`** — `shapeId: "stair"`.
  L-cross-section stair: full bottom slab + upper half-block at back (`z = 0.5–1`).
  High step at `+Z`. Occludes `-Y` and `+Z`.

- **`StairCornerInner`** — `shapeId: "stairCornerInner"`.
  Concave inner-corner stair. Full bottom slab; upper L-shaped block (3/4 top) with two inner
  risers. Occludes `-Y`, `+Z`, and `+X`.

- **`StairCornerOuter`** — `shapeId: "stairCornerOuter"`.
  Convex outer-corner stair. Full bottom slab; upper quarter-block at front-left only.
  Occludes `-Y` only.

- **`StairFlip`** — `shapeId: "stairFlip"`.
  Y-flipped `Stair` — hangs from the ceiling. Occludes `+Y` and `+Z`.

- **`StairCornerInnerFlip`** — `shapeId: "stairCornerInnerFlip"`.
  Y-flipped `StairCornerInner`. Occludes `+Y`, `+Z`, and `+X`.

- **`StairCornerOuterFlip`** — `shapeId: "stairCornerOuterFlip"`.
  Y-flipped `StairCornerOuter`. Occludes `+Y` only.

---

## Slab — SlabType

```ts
type SlabType = "top" | "bottom";
```

Passed to the `Slab` constructor to select which half of the block space the slab occupies.
The default is `"bottom"`.

---

## Pole — PoleAxis

```ts
type PoleAxis = "x" | "z";
```

Passed to the `Pole` constructor to select the axis along which the beam runs.
The default is `"z"`.

---

## Custom Shapes

Implement `BlockShape` and register the instance via the `shapes` option or `shapeRegistry.register()`:

```ts
import type { BlockShape, FaceDefinition, Face } from "@jolly-pixel/voxel.renderer";

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
const vr = actor.addComponentAndGet(VoxelRenderer, {
  shapes: [new MyShape()]
});

// Option B — at any time before voxels are placed
vr.shapeRegistry.register(new MyShape());
```

Then reference the shape in a `BlockDefinition`:

```ts
vr.blockRegistry.register({
  id: 10,
  name: "Custom",
  shapeId: "myShape",
  collidable: true,
  faceTextures: {},
  defaultTexture: { col: 0, row: 0 }
});
```


# Collision.md

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


# Serialization.md

# Serialization

Save and restore world state as plain JSON. Version 1 stores voxels as a sparse map
keyed by `"x,y,z"` strings for human readability and easy diffing.
Tileset metadata is embedded so the loader can restore textures automatically.

---

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
  /** World-space translation of the layer. Absent in files produced before layer offsets were introduced; treated as {x:0,y:0,z:0} on load. */
  offset?: { x: number; y: number; z: number };
  voxels: Record<VoxelEntryKey, VoxelEntryJSON>;
}

/**
 * Voxel keys are always world-space coordinates (layer offset included).
 * Files produced before layer offsets were introduced carry no `offset` field
 * and are loaded as if offset is {0,0,0} — identical to the previous behaviour.
 */

interface VoxelObjectJSON {
  id: number;
  name: string;
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

interface VoxelObjectLayerJSON {
  id: number;
  name: string;
  visible: boolean;
  order: number;
  objects: VoxelObjectJSON[];
}

type VoxelObjectProperties = Record<string, string | number | boolean>;

interface VoxelWorldJSON {
  version: 1;
  chunkSize: number;
  tilesets: TilesetDefinition[];
  layers: VoxelLayerJSON[];
  /** Block definitions embedded by converters (e.g. TiledConverter). Auto-registered on load. */
  blocks?: BlockDefinition[];
  /** Object layers produced by converters from Tiled object layers. */
  objectLayers?: VoxelObjectLayerJSON[];
}
```

---

## VoxelSerializer

Low-level serialiser. Most users should prefer the higher-level `VoxelRenderer.save()` /
`VoxelRenderer.load()`, which also handle material invalidation and chunk rebuilds.

#### `serialize(world: VoxelWorld, tilesetManager: TilesetManager): VoxelWorldJSON`

Converts the world and tileset metadata to a plain JSON-serialisable object.

#### `deserialize(data: VoxelWorldJSON, world: VoxelWorld): void`

Clears `world` and restores it from a snapshot. Throws if `data.version !== 1`.

---

## Example

```ts
// Save
const json = vr.save();
localStorage.setItem("map", JSON.stringify(json));

// Load
const data = JSON.parse(localStorage.getItem("map")!) as VoxelWorldJSON;
await vr.load(data);
```


# TiledConverter.md

# TiledConverter

Converts a Tiled JSON map (`TiledMap`) to `VoxelWorldJSON` for import via `VoxelRenderer.load()`.

Tile layers become voxel layers. Object layers become `VoxelObjectLayerJSON` entries with
pixel-to-voxel coordinate conversion. Group layers are flattened recursively.
Block definitions derived from the tileset are embedded in `result.blocks` so they are
auto-registered when passed to `VoxelRenderer.load()`.

Infinite maps and compressed tile data are not supported.

---

## TiledConverterOptions

```ts
interface TiledConverterOptions {
  /**
   * Resolves a Tiled tileset source path to a runtime URL or asset path.
   * Called once per tileset found in the map.
   */
  resolveTilesetSrc: (tiledSource: string, tilesetId: string) => string;
  /** Side length of each chunk in voxels. Default: `16`. */
  chunkSize?: number;
  /**
   * "stacked" — each Tiled layer is placed at its own Y level (layer index).
   * "flat"    — all layers are placed at Y = 0; higher layers occlude lower ones.
   * Default: "stacked".
   */
  layerMode?: "flat" | "stacked";
  /** Shape ID applied to every voxel. Default: `"fullCube"`. */
  defaultShapeId?: BlockShapeID;
  /** Whether voxels are collidable. Default: `true`. */
  collidable?: boolean;
}
```

---

## TiledConverter

### Methods

#### `convert(map: TiledMap, options: TiledConverterOptions): VoxelWorldJSON`

Converts the Tiled map to a `VoxelWorldJSON` object ready to pass to `VoxelRenderer.load()`.

---

## TiledMap

TypeScript types for the Tiled JSON Map Format 1.11.x. Import `TiledMap` when you need to
type the raw JSON before converting:

```ts
import type { TiledMap } from "@jolly-pixel/voxel.renderer";
```

---

## Example

```ts
import { TiledConverter, VoxelRenderer } from "@jolly-pixel/voxel.renderer";
import type { TiledMap } from "@jolly-pixel/voxel.renderer";

const tiledMap: TiledMap = await fetch("map.json").then(r => r.json());

const converter = new TiledConverter();
const worldJson = converter.convert(tiledMap, {
  resolveTilesetSrc: (_src, tilesetId) => `assets/${tilesetId}.png`,
  layerMode: "stacked"
});

// loadRuntime's ~850 ms splash delay ensures local assets finish before awake() runs,
// so load() can safely be called fire-and-forget here.
vr.load(worldJson);
```


# Tileset.md

# Tileset

Tileset loading, UV computation, and pixel-art texture management.
`NearestFilter` and `SRGBColorSpace` are applied automatically to preserve pixel-art crispness.

---

## TilesetDefinition

Describes an atlas image.

```ts
interface TilesetDefinition {
  id: string;        // Unique identifier; referenced by TileRef.tilesetId
  src: string;       // URL or path to the atlas image
  tileSize: number;  // Tile width and height in pixels (tiles are square)
  cols?: number;     // Number of tile columns — auto-derived from the image if omitted
  rows?: number;     // Number of tile rows — auto-derived from the image if omitted
}
```

---

## TileRef

References a specific tile in an atlas by grid position.

```ts
interface TileRef {
  col: number;
  row: number;
  tilesetId?: string; // omit to use the default (first loaded) tileset
}
```

---

## TilesetUVRegion

Precomputed UV atlas region returned by `TilesetManager.getTileUV()`.

```ts
interface TilesetUVRegion {
  offsetU: number; // U coordinate of the tile's bottom-left corner
  offsetV: number; // V coordinate (Y-flipped for WebGL origin)
  scaleU: number;  // Tile width in UV space
  scaleV: number;  // Tile height in UV space
}
```

---

## TilesetManager

Manages tileset textures and UV lookup. Accessible via `VoxelRenderer.tilesetManager`.

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

#### `dispose(): void`

Disposes all textures and materials and clears the registry.

---

## Example

```ts
await vr.loadTileset({
  id: "default",
  src: "assets/tileset.png",
  tileSize: 16
  // cols and rows are optional — derived from the image at load time
});

// Tile at column 2, row 0 — uses the default tileset
const tileRef: TileRef = { col: 2, row: 0 };

// Tile from a secondary tileset
const decorTile: TileRef = { col: 0, row: 3, tilesetId: "decor" };
```


# VoxelRenderer.md

# VoxelRenderer

`ActorComponent` that renders a layered voxel world as chunked Three.js meshes.
Each chunk is rebuilt only when its content changes, keeping GPU work proportional to edits rather than world size.

---

## VoxelRendererOptions

```ts
type MaterialCustomizerFn = (
  material: THREE.MeshLambertMaterial | THREE.MeshStandardMaterial,
  tilesetId: string
) => void;

interface VoxelRendererOptions {
  /**
   * @default 16
   */
  chunkSize?: number;
  /**
   * Enables collision shapes when provided.
   * disabled by default to avoid forcing Rapier as a dependency for users who don't need physics.
   */
  rapier?: {
    /** Rapier3D module (static API) */
    api: RapierAPI;
    /** Rapier3D world instance */
    world: RapierWorld;
  };
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
   * Optional logger instance for debug output.
   * Uses the engine's default logger if not provided.
   */
  logger?: Systems.Logger;

  /**
   * Optional callback that is called whenever a layer is added, removed, or updated.
   * Useful for synchronizing external systems with changes to the voxel world.
   */
  onLayerUpdated?: VoxelLayerHookListener;
}
```

---

## VoxelSetOptions

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
}
```

---

## VoxelRemoveOptions

```ts
interface VoxelRemoveOptions {
  position: THREE.Vector3Like;
}
```

---

## VoxelRotation

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

---

## VoxelRenderer

Extends `ActorComponent`.

### Properties

```ts
readonly world: VoxelWorld;
readonly blockRegistry: BlockRegistry;
readonly shapeRegistry: BlockShapeRegistry;
readonly tilesetManager: TilesetManager;
readonly serializer: VoxelSerializer;
```

### Methods

#### `getLayer(name: string): VoxelLayer`

Find a layer or `null` if none is found with **name**.

#### `addLayer(name: string, options?: VoxelLayerConfigurableOptions): VoxelLayer`

Creates and returns a new named layer.

options is described by the following interface:
```ts
interface VoxelLayerConfigurableOptions {
  visible?: boolean;
  properties?: Record<string, any>;
}
```

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

#### `setVoxel(layerName: string, options: VoxelSetOptions): void`

Places a voxel at a world-space position.

#### `removeVoxel(layerName: string, options: VoxelRemoveOptions): void`

Removes the voxel at a world-space position.

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

#### `loadTileset(def: TilesetDefinition): Promise<void>`

Loads a tileset image via the actor's loading manager. The first loaded tileset becomes
the default for `TileRef` values with no explicit `tilesetId`.

#### `save(): VoxelWorldJSON`

Serialises the full world state (layers, voxels, tileset metadata) to a plain JSON object.

#### `load(data: VoxelWorldJSON): Promise<void>`

Clears the current world, restores state from a JSON snapshot, and reloads any
referenced tilesets that are not already loaded.

### Hooks

```ts
export type VoxelLayerHookAction =
  | "added"
  | "removed"
  | "updated"
  | "offset-updated"
  | "voxel-set"
  | "voxel-removed";

export interface VoxelLayerHookEvent {
  layerName: string;
  action: VoxelLayerHookAction;
  metadata: Record<string, any>;
}
export type VoxelLayerHookListener = (
  event: VoxelLayerHookEvent
) => void;
```

---

## Example

```ts
const vr = actor.addComponentAndGet(VoxelRenderer, {
  layers: ["Ground"],
  blocks: [
    {
      id: 1, name: "Grass", shapeId: "fullCube", collidable: true,
      faceTextures: {}, defaultTexture: { col: 0, row: 0 }
    }
  ]
});

await vr.loadTileset({ id: "default", src: "tileset.png", tileSize: 16 });

// Place a voxel
vr.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: 1 });

// Place a rotated voxel
vr.setVoxel("Ground", { position: { x: 1, y: 0, z: 0 }, blockId: 1, rotation: VoxelRotation.CW90 });

// Read back
const entry = vr.getVoxel({ x: 0, y: 0, z: 0 });

// Move an entire layer in world space (e.g. snap a prefab layer to a new grid position)
vr.setLayerOffset("Ground", { x: 8, y: 0, z: 0 });

// Shift a layer incrementally
vr.translateLayer("Ground", { x: 0, y: 1, z: 0 });
```


# World.md

# World

Data model for the voxel world: layers, chunks, and per-voxel entries.

---

## Types

```ts
/** World-space integer position. Any `THREE.Vector3Like` is accepted wherever `VoxelCoord` is expected. */
interface VoxelCoord {
  x: number;
  y: number;
  z: number;
}

interface VoxelEntry {
  blockId: number;   // references BlockDefinition.id; 0 = air (never stored)
  transform: number; // packed rotation + flip flags — write via VoxelRenderer.setVoxel
}
```

---

## VoxelWorld

Top-level container for a layered voxel scene. Layers are composited from highest `order`
to lowest — the first visible layer that has a voxel at a given position wins.
This allows decorative layers to override base terrain non-destructively.

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

Composited read — returns the voxel from the highest-priority visible layer at that position.
Returns `undefined` for air.

#### `getVoxelNeighbour(position: VoxelCoord, face: Face): VoxelEntry | undefined`

Composited read of the voxel immediately adjacent to `position` in the given face direction.

#### `setVoxelAt(layerName: string, position: VoxelCoord, entry: VoxelEntry): void`

Writes a voxel directly and marks neighbouring chunks dirty for boundary face re-evaluation.
Throws if the layer is not found. Prefer `VoxelRenderer.setVoxel` to handle rotation packing.

#### `removeVoxelAt(layerName: string, position: VoxelCoord): void`

Removes a voxel. No-op if the layer is not found.

#### `getAllChunks(): Generator<[VoxelLayer, VoxelChunk]>`

Iterates over every chunk across all layers.

#### `getAllDirtyChunks(): Generator<[VoxelLayer, VoxelChunk]>`

Iterates over chunks whose `dirty` flag is set.

#### `clear(): void`

Removes all layers.

---

## VoxelLayer

A named, ordered collection of `VoxelChunk`s. Returned by `VoxelWorld.addLayer()`.

### VoxelLayerOptions

```ts
interface VoxelLayerOptions {
  id: string;
  name: string;
  order: number;
  chunkSize: number;
  visible?: boolean;  // default: true
  offset?: VoxelCoord; // default: {x:0, y:0, z:0}
}
```

### Properties

```ts
readonly id: string;          // auto-assigned unique identifier, stable across the session
readonly name: string;
readonly order: number;       // compositing priority — higher values win
readonly visible: boolean;
offset: VoxelCoord;           // world-space translation applied to every voxel in the layer
readonly chunkCount: number;  // number of currently allocated chunks
```

> **Offset semantics** — `offset` shifts where voxels appear in world space without
> changing the underlying chunk storage. A voxel set at local position `{0,0,0}` renders
> at `{offset.x, offset.y, offset.z}`. Use `VoxelWorld.setLayerOffset` or
> `translateLayer` (preferred) so all dependent chunks are marked dirty automatically.

---

## VoxelChunk

Fixed-size, sparse 3D grid of `VoxelEntry` data. Chunk coordinates `(cx, cy, cz)` are in
**chunk space** — multiply by `chunkSize` to get the world-space origin.

### Constructor

```ts
new VoxelChunk([cx, cy, cz]: [number, number, number], size?: number)
```

### Properties

```ts
readonly cx: number;
readonly cy: number;
readonly cz: number;
readonly size: number;    // side length in voxels
dirty: boolean;           // set true on any write; cleared by VoxelRenderer after mesh rebuild
readonly voxelCount: number;
```

### Methods

#### `get(lx: number, ly: number, lz: number): VoxelEntry | undefined`

#### `set(lx: number, ly: number, lz: number, entry: VoxelEntry): void`

#### `delete(lx: number, ly: number, lz: number): void`

#### `isEmpty(): boolean`

#### `entries(): IterableIterator<[number, VoxelEntry]>`

Iterates all stored entries as `[linearIndex, VoxelEntry]` pairs.

#### `linearIndex(lx: number, ly: number, lz: number): number`

Converts local chunk coordinates to the flat map key used for sparse storage.

#### `fromLinearIndex(idx: number): [number, number, number]`

Inverse of `linearIndex`.

---

## Constants

```ts
const DEFAULT_CHUNK_SIZE = 16;
```


