# README.md

<h1 align="center">
  Voxel.Renderer
</h1>

<p align="center">
  JollyPixel Voxel Engine and Renderer
</p>

<p align="center">
  <img src="./docs/images/noise-world.png">
</p>

## 📌 About

Chunked voxel engine and Three.js renderer. Use `VoxelEngine` directly, or `VoxelRenderer` to plug it into a JollyPixel [engine][engine] (ECS) scene.

## 💡 Features

- Chunked world (default 16³) - only dirty chunks are rebuilt each frame, the rest are left alone
- Named layers composited top-down; decorative layers override base terrain without Z-fighting
- Toggle visibility, reorder, add/remove layers, and move them in world space
- Face culling between adjacent solid voxels to keep triangle counts low
- Optional greedy meshing (`greedy: true`) merging coplanar identical faces - about 3x fewer triangles on terrain
- Many built-in block shapes (cube, slabs, ramp, corners, pole, stairs) and a `BlockShape` interface for custom geometry
- Per-block transforms via a packed byte - 90° Y rotations and X/Z flips without duplicating definitions
- Multiple tilesets at different resolutions; tiles referenced by `{ tilesetId, col, row }`
- Per-face texture overrides on any block definition
- `"lambert"` (default) or `"standard"` (PBR) material modes
- Configurable `alphaTest` for foliage and sprite-style cutout blocks
- `save()` / `load()` round-trips the full world state as plain JSON
- `TiledConverter` to import Tiled `.tmj` maps in `"stacked"` or `"flat"` layer modes
- Optional physics through the backend-agnostic `VoxelCollider` interface, with `"box"` or `"trimesh"` colliders rebuilt per dirty chunk and a Rapier3D plugin included; zero extra dependency if omitted
- Compatible with JollyPixel engine logger
- Debug mode (`engine.debug`) exposing live face/triangle counts and a wireframe view of the meshed chunks

## 💃 Getting Started

Install the package with npm:

```bash
npm install @jolly-pixel/voxel.renderer
```

Load atlas textures before creating the renderer. The following example runs
inside a JollyPixel actor lifecycle where `actor` is available:

```ts
import {
  Face,
  VoxelRenderer,
  loadTilesets,
  type BlockDefinition
} from "@jolly-pixel/voxel.renderer";

const tilesets = await loadTilesets([
  {
    id: "default",
    src: "tileset/UV_cube.png",
    tileSize: 32
  }
]);

const blocks: BlockDefinition[] = [
  {
    id: 1,
    name: "Dirt",
    shapeId: "cube",
    collidable: true,
    defaultTexture: {
      tilesetId: "default",
      col: 2,
      row: 0
    },
    faceTextures: {
      [Face.PosY]: {
        tilesetId: "default",
        col: 0,
        row: 2
      }
    }
  }
];

const renderer = actor.addComponentAndGet(VoxelRenderer, {
  tilesets,
  layers: ["Ground"],
  blocks
});
```

Place voxels through the engine exposed by the component:

```ts
for (let x = 0; x < 8; x++) {
  for (let z = 0; z < 8; z++) {
    renderer.engine.setVoxel("Ground", {
      position: {
        x,
        y: 0,
        z
      },
      blockId: 1
    });
  }
}
```

`VoxelRenderer` attaches `engine.root` to the actor and drives the engine
lifecycle. Use `VoxelEngine` directly for a standalone Three.js or headless
integration; then the application owns `init()`, `tick()`, `flush()`, and
`dispose()`.

## 📚 Documentation

### Concepts and guides

- [World model](docs/concepts/world-model.md): layers, chunks, compositing, and
  ownership.
- [Rendering and meshing](docs/concepts/rendering-and-meshing.md): dirty chunk
  rebuilds, geometry layout, and greedy meshing.
- [Atlas padding](docs/concepts/atlas-padding.md): source and render textures.
- [Loading tilesets](docs/guides/loading-and-restoring-tilesets.md),
  [creating custom shapes](docs/guides/creating-custom-shapes.md), and
  [saving worlds](docs/guides/saving-and-loading-worlds.md).
- [Adding physics](docs/guides/adding-physics.md),
  [network synchronization](docs/guides/synchronizing-a-world.md),
  [Tiled import](docs/guides/importing-a-tiled-map.md), and
  [persistent voxel maps](docs/guides/persisting-a-voxel-map.md).

### Core and world API

- [`VoxelEngine`](docs/api/core/VoxelEngine.md) and
  [`VoxelRenderer`](docs/api/core/VoxelRenderer.md).
- [`VoxelDebugger` and mesh statistics](docs/api/core/VoxelDebugger.md), and
  [hook events](docs/api/core/hooks.md).
- [`VoxelWorld`](docs/api/world/VoxelWorld.md),
  [`VoxelLayer`](docs/api/world/VoxelLayer.md),
  [`VoxelChunk`](docs/api/world/VoxelChunk.md), and
  [`VoxelStore`](docs/api/world/VoxelStore.md).

### Blocks, tilesets, and rendering API

- [`BlockDefinition`](docs/api/blocks/BlockDefinition.md),
  [`BlockRegistry` and tileset block generation](docs/api/blocks/BlockRegistry.md),
  [`BlockShape`](docs/api/blocks/BlockShape.md), and
  [`BlockShapeRegistry`](docs/api/blocks/BlockShapeRegistry.md).
- [Built-in shapes](docs/api/blocks/built-in-shapes.md) and
  [tilesets](docs/api/tilesets/tilesets.md).
- [Rendering, meshing, and tile wrapping](docs/concepts/rendering-and-meshing.md),
  [`VoxelCollider`](docs/api/collision/VoxelCollider.md), and
  [`RapierVoxelCollider`](docs/api/collision/RapierVoxelCollider.md).

### Serialization and integration API

- [Serialization, document codec, and voxel objects](docs/api/serialization/serialization.md).
- [`VoxelSyncClient`](docs/api/network/VoxelSyncClient.md),
  [`VoxelSyncServer`](docs/api/network/VoxelSyncServer.md),
  [`VoxelCommandArbiter`](docs/api/network/VoxelCommandArbiter.md), and the
  [network protocol](docs/api/network/protocol.md).
- [`TiledConverter`](docs/api/tiled/TiledConverter.md),
  including its JSON types, and
  [`TiledMapAssetLoader`](docs/api/tiled/TiledMapAssetLoader.md).
- [Voxel-map asset-server APIs](docs/api/asset-server/voxel-map-assets.md).

## 🚀 Running the examples

Seven interactive examples live in the `examples/` directory and are served by Vite. Start the dev server from the package root:

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
| `http://localhost:5173/noise-world.html` | `demo-noise-world.ts` | A Minecraft-like world generated from simplex noise, with live renderer and mesh counters - the benchmark example |
| `http://localhost:5173/flat-world.html` | `demo-flat-world.ts` | A server-authoritative flat world edited by several browsers at once, with peer brushes over the room's presence channel |
| `http://localhost:5173/transparency.html` | `demo-transparency.ts` | A diorama for checking transparency and lighting: blended water and glass, cutout leaves/grates/windows with and without `transparent: true`, an alpha-gradient probe for `alphaTest`, and live light, material and layer controls |

## 🧪 Benchmarks

### Noise-world benchmark

Use `noise-world.html` to measure the renderer under load. It builds a heightmap world from simplex noise and reports two separate costs: voxel writes via `setVoxel` and chunk meshing for dirty chunks.

It is configurable from the query string:

```text
/noise-world.html?size=512&chunk=32&seed=42
```

| Param | Default | Effect |
|---|---:|---|
| `size` | `256` | World width/depth in voxels (`size²` columns) |
| `chunk` | `16` | `chunkSize`; trades draw calls against rebuild cost |
| `seed` | `1337` | Terrain seed; the same seed always yields the same world |

### Headless benchmark

The browser HUD is only a sanity check; Vite's checker inflates timings. Run headless instead:

```bash
npm run bench
npm run bench -- --greedy
npm run bench:compare
```

Use the minimum of three runs when comparing numbers, since single runs can drift a lot on a throttled machine.

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

const renderer = actor.addComponentAndGet(VoxelRenderer, {
  logger: new Systems.Logger({
    level: "trace",
    namespaces: ["*"]
  })
});
```

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
[contributing]: ../../CONTRIBUTING.md
[engine]: https://github.com/JollyPixel/editor/tree/main/packages/engine


# voxel-map-assets.md

# Voxel-map asset APIs

The asset subpath exports the handler, event-sourced state, and network
extension used by `@jolly-pixel/asset-server`.

The subpath also re-exports the voxel document codec and the tileset definition
helpers used by server integrations.

## `voxelMapAssetHandler`

`voxelMapAssetHandler()` creates the `AssetKindHandler` for persisted voxel
maps.

```ts
const VOXEL_MAP_KIND = "voxelmap";
const VOXEL_MAP_COMMAND = "voxelmap.command";

interface VoxelMapAssetHandlerOptions {
  match?: readonly string[];
  chunkSize?: number;
  snapshot?: SnapshotPolicy;
  conflictResolver?: network.ConflictResolver<VoxelNetworkCommand>;
}

function voxelMapAssetHandler(
  options?: VoxelMapAssetHandlerOptions
): AssetKindHandler<VoxelMapState>;
```

`match` defaults to `["**/*.voxelmap.json"]`; `chunkSize` defaults to `16`.
The default snapshot policy waits for 5 seconds of quiet and has a 60-second
maximum delay.

The handler serializes state with `encodeVoxelDocument()` and creates a
`VoxelMapAssetExtension` for each room binding.

Applied events never escape as exceptions. Malformed asset or command events
are logged and skipped so later events can continue replaying from the last
valid state.

## `VoxelMapState`

`VoxelMapState` owns the headless world and tileset metadata for one persisted
voxel map.

```ts
class VoxelMapState {
  readonly world: VoxelWorld;
  tilesets: TilesetDefinition[];

  constructor(chunkSize: number);
  toJSON(): VoxelWorldJSON;
  load(document: VoxelWorldJSON): void;
  clear(): void;
}
```

`VoxelWorld` does not own the tileset list carried by a document, so the state
stores both. `load()` replaces the world and copies the document's tilesets.
`clear()` removes all world layers and resets the list.

`toJSON()` serializes the world with the stored tileset definitions. Loading a
document with a different chunk size throws `InvalidVoxelDocumentError` and
leaves the state unchanged.

## `VoxelMapAssetExtension`

`VoxelMapAssetExtension` connects a voxel-map asset room to its event store.

```ts
interface VoxelMapAssetExtensionOptions {
  commandEventType: string;
  conflictResolver?: network.ConflictResolver<VoxelNetworkCommand>;
}

class VoxelMapAssetExtension extends network.Extension {
  readonly id: string;
  readonly name: string;
  readonly events: readonly string[];

  constructor(
    binding: AssetRoomBinding<VoxelMapState>,
    options: VoxelMapAssetExtensionOptions
  );
  onClientConnect(client: network.ClientHandle): void;
  onClientDisconnect(clientId: string): void;
  getEventName(payload: unknown): string;
  onMessage(
    clientId: string,
    payload: unknown,
    context: network.RoomContext
  ): Promise<void>;
}
```

The extension appends accepted commands to the event store. The handler's
`apply()` function is the only code that mutates state. Applying a command in
the room as well would replay it twice; an offset delta would then move a layer
twice as far.

Full-world replacement bypasses arbitration, appends one event, and broadcasts
a fresh snapshot. Other accepted commands are recorded by
`VoxelCommandArbiter` after the event-store append succeeds.


# BlockDefinition.md

# BlockDefinition

`BlockDefinition` is the authoring form accepted by `BlockRegistry.register()`
and `VoxelEngineOptions.blocks`. Only `id`, `name`, and `shapeId` are required.

```ts
interface BlockDefinition {
  id: number;
  name: string;
  shapeId: BlockShapeID;
  faceTextures?: Partial<Record<Face, TileRef>>;
  defaultTexture?: TileRef;
  collidable?: boolean;
  transparent?: boolean;
  defaultTilesetId?: string;
}
```

Missing `faceTextures` entries use `defaultTexture`. `collidable` defaults to
`true`, and `transparent` defaults to `false`. A transparent block does not hide
a neighbouring face. `defaultTilesetId` fills tile references that omit a
tileset and is removed from the resolved definition.

```ts
registry.register({
  id: 1,
  name: "Stone",
  shapeId: "cube"
});
```

## ResolvedBlockDefinition

`BlockRegistry` stores resolved definitions. Defaults have been applied, tuple
tile references have been expanded, and `defaultTilesetId` is no longer present.

```ts
type ResolvedBlockDefinition =
  & Omit<
    BlockDefinition,
    "faceTextures" | "defaultTexture" | "collidable" | "defaultTilesetId"
  >
  & {
    faceTextures: Partial<Record<Face, ResolvedTileRef>>;
    defaultTexture?: ResolvedTileRef;
    collidable: boolean;
  };

function resolveBlockDefinition(
  definition: BlockDefinition
): ResolvedBlockDefinition;
```

`resolveBlockDefinition()` returns a new object and does not mutate the input
definition or its tile references. `BlockRegistry.register()` calls it for each
registration.

## Air

```ts
const AIR_BLOCK_ID = 0;

function isAir(blockId: number): boolean;
```

ID `0` is reserved for air and is never stored. Registering a definition with
that ID throws `Error`; packing or writing it throws `RangeError`. Remove a
voxel with `removeVoxel()` instead.

Packed reads return `VOXEL_ABSENT` for air, while object reads return
`undefined`. See [packed voxel values](../world/VoxelChunk.md#packed-voxel-values).


# BlockRegistry.md

# BlockRegistry

`BlockRegistry` maps numeric block IDs to resolved block definitions.
`VoxelEngine.blockRegistry` exposes the engine's registry.

## API

```ts
interface BlockRegisterManyOptions {
  skipExisting?: boolean;
}

class BlockRegistry implements Iterable<ResolvedBlockDefinition> {
  readonly nextId: number;
  readonly version: number;

  constructor(definitions?: BlockDefinition[]);
  register(definition: BlockDefinition): this;
  registerMany(
    definitions: Iterable<BlockDefinition>,
    options?: BlockRegisterManyOptions
  ): this;
  get(id: number): ResolvedBlockDefinition | undefined;
  has(id: number): boolean;
  getAll(): IterableIterator<ResolvedBlockDefinition>;
  [Symbol.iterator](): IterableIterator<ResolvedBlockDefinition>;
}
```

`register()` resolves the definition and replaces any definition already using
the ID. It throws for `AIR_BLOCK_ID`.

`registerMany()` applies the same operation to each input. With
`skipExisting: true`, an existing local definition wins. This is used when a
saved document or converter output embeds block definitions.

`nextId` is one above the highest ID ever registered. It never returns `0` and
does not reuse gaps. It is not clamped to `MAX_BLOCK_ID`; packing a larger ID
fails when the voxel is written.

`version` increments for each completed registration. Geometry caches use it to
detect stale compiled block data.

## Creating blocks from a tileset

`blocksFromTileset()` creates one cube block for each tile in a resolved atlas.
IDs start at `1` and follow row-major order.

```ts
interface BlocksFromTilesetOptions {
  limit?: number;
  map?: (
    blockId: number,
    col: number,
    row: number
  ) => BlockOverrides;
}

type BlockOverrides = Partial<
  Pick<
    ResolvedBlockDefinition,
    "name" | "shapeId" | "collidable" | "transparent"
  >
>;

function blocksFromTileset(
  definition: ResolvedTilesetDefinition,
  options?: BlocksFromTilesetOptions
): IterableIterator<ResolvedBlockDefinition>;
```

`limit` defaults to 255 and is inclusive. Generated blocks default to
`collidable: false`; use `map` when the atlas represents solid terrain.

```ts
const definition = engine.tilesetManager.atlas().def;

engine.blockRegistry.registerMany(
  blocksFromTileset(definition, {
    limit: 32,
    map: () => ({ collidable: true })
  })
);
```


# BlockShape.md

# BlockShape

`BlockShape` describes the render and collision geometry for one shape ID. The
built-in implementations are listed in [built-in shapes](./built-in-shapes.md).

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
  | (string & {});

type BlockCollisionHint = "box" | "trimesh" | "none";

interface BlockShape {
  readonly id: BlockShapeID;
  readonly faces: readonly FaceDefinition[];
  readonly collisionHint: BlockCollisionHint;

  occludes(face: Face): boolean;
}
```

Unknown shape IDs compile because of the open string member, but the mesh
builder cannot resolve them unless they have been registered.

`occludes()` returns `true` when the shape completely covers the requested
axis-aligned face. Partial shapes return `false` so the mesh builder does not
remove visible neighbour geometry.

## FaceDefinition

```ts
interface FaceDefinition {
  face: Face;
  cull?: Face | null;
  normal: Vec3;
  vertices: readonly Vec3[];
  uvs: readonly Vec2[];
}
```

`face` selects the texture slot and default culling direction. An omitted
`cull` uses `face`; `null` disables culling. Vertices use normalized block space
and a face may contain three or four of them. A quad is triangulated as
`[0, 1, 2]` and `[0, 2, 3]`.

## Face

```ts
const Face = {
  PosX: 0,
  NegX: 1,
  PosY: 2,
  NegY: 3,
  PosZ: 4,
  NegZ: 5
} as const;

type Face = typeof Face[keyof typeof Face];
```

See [creating custom shapes](../../guides/creating-custom-shapes.md) for a
complete registration example.


# BlockShapeRegistry.md

# BlockShapeRegistry

`BlockShapeRegistry` maps shape IDs to implementations. `VoxelEngine` creates a
registry containing all [built-in shapes](./built-in-shapes.md).

## API

```ts
class BlockShapeRegistry implements Iterable<BlockShape> {
  readonly version: number;

  register(shape: BlockShape): this;
  get(id: BlockShapeID): BlockShape | undefined;
  has(id: BlockShapeID): boolean;
  getAll(): IterableIterator<BlockShape>;
  ids(): IterableIterator<BlockShapeID>;
  [Symbol.iterator](): IterableIterator<BlockShape>;

  static createDefault(): BlockShapeRegistry;
}
```

Iteration preserves registration order. `version` increments on each
registration so mesh caches can detect a changed shape. `createDefault()`
returns a standalone registry with the built-in implementations already
registered.


# built-in-shapes.md

# Built-in shapes

All shapes below are registered automatically by `VoxelEngine`. They are also available
standalone via `BlockShapeRegistry.createDefault()`.

## Class exports

The root package exports each implementation class:

| Class | Constructor | Default ID |
|---|---|---|
| `Cube` | `new Cube(id?)` | `"cube"` |
| `Slab` | `new Slab(type?, id?)` | `"slabBottom"` or `"slabTop"` |
| `Pole` | `new Pole()` | `"pole"` |
| `PoleY` | `new PoleY()` | `"poleY"` |
| `Ramp` | `new Ramp(id?)` | `"ramp"` |
| `RampCornerInner` | `new RampCornerInner(id?)` | `"rampCornerInner"` |
| `RampCornerOuter` | `new RampCornerOuter(id?)` | `"rampCornerOuter"` |
| `Stair` | `new Stair(id?)` | `"stair"` |
| `StairCornerInner` | `new StairCornerInner(id?)` | `"stairCornerInner"` |
| `StairCornerOuter` | `new StairCornerOuter(id?)` | `"stairCornerOuter"` |

`SlabType` is `"top" | "bottom"`; its default is `"bottom"`.

## Shape Reference

![Available block shapes](../../images/shapes.png)

### Solid / Slab

All shapes in this category use `collisionHint: "box"`. See
[`VoxelCollider`](../collision/VoxelCollider.md).

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

All pole shapes use `collisionHint: "trimesh"` and occlude no faces because
their cross-section does not fill a voxel.

| Shape ID | Occludes |
|---:|---|
| `poleY` | — |
| `pole` | — |

### Ramps

All ramp shapes use `collisionHint: "trimesh"`.

| Shape ID | Occludes |
|---:|---|
| `ramp` | `-Y`, `+Z` |
| `rampCornerInner` | `-Y`, `+Z`, `+X` |
| `rampCornerOuter` | `-Y` |

### Stairs

All stair shapes use `collisionHint: "trimesh"`.

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

Custom implementations use the same `BlockShape` contract. See
[creating custom shapes](../../guides/creating-custom-shapes.md).


# RapierVoxelCollider.md

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


# VoxelCollider.md

# VoxelCollider

`VoxelCollider` is the contract between `VoxelEngine` and a physics backend.
Collision is disabled unless `VoxelEngineOptions.collider` supplies a factory.

## API

```ts
interface VoxelChunkCollision {
  chunk: VoxelChunk;
  geometries: ReadonlyMap<string, THREE.BufferGeometry>;
  layerOffset: VoxelCoord;
}

interface VoxelCollider {
  rebuildChunk(
    key: string,
    collision: VoxelChunkCollision
  ): void;
  removeChunk(key: string): void;
  dispose(): void;
}

interface VoxelColliderContext {
  blockRegistry: BlockRegistry;
  shapeRegistry: BlockShapeRegistry;
}

type VoxelColliderFactory = (
  context: VoxelColliderContext
) => VoxelCollider;
```

`rebuildChunk()` replaces any collider registered under `key`.
`removeChunk()` is a no-op for an unknown key. Implementations own their physics
handles and release all remaining resources from `dispose()`.

The geometry map follows renderer draw groups and is split by tileset and
cutout mode. Treat its string keys as opaque.

## Geometry merging

```ts
interface MergedChunkGeometry {
  geometry: THREE.BufferGeometry;
  owned: boolean;
}

function mergeChunkGeometries(
  geometries: ReadonlyMap<string, THREE.BufferGeometry>
): MergedChunkGeometry | null;
```

The function returns `null` when there is no collision geometry. Dispose the
returned geometry only when `owned` is `true`.

## Collision strategy

Each block shape supplies one collision hint:

- `"box"` creates one unit cuboid per solid voxel.
- `"trimesh"` uses the chunk's rendered triangles.
- `"none"` excludes the block from collision.

If any block in a chunk requests `"trimesh"`, the complete chunk uses one
triangle mesh. It falls back to cuboids when no triangle geometry is available.

Layer opacity does not affect collision until it reaches `0`, which behaves as
a hidden layer and removes its colliders.

See [adding physics](../../guides/adding-physics.md) for setup with the bundled
Rapier implementation.


# hooks.md

# Hooks

Hooks report voxel, layer, and object-layer changes from `VoxelEngine`. They are
useful for synchronizing a voxel world with another client or system.

```ts
import {
  VoxelEngine,
  type VoxelLayerHookEvent
} from "@jolly-pixel/voxel.renderer";

function onLayerUpdated(
  event: VoxelLayerHookEvent
): void {
  // Narrow on `action` to get a fully-typed `metadata`.
  if (event.action === "voxel-set") {
    console.log(event.metadata.position, event.metadata.blockId);
  }
}

const engine = new VoxelEngine({
  onLayerUpdated
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
| `"cloned"` | `{ options: PartialExcept<VoxelLayerOptions, "name"> }` | `layerName` is the source layer. |
| `"merged"` | `{ targetLayerName: string }` | `layerName` is the source layer. |
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
`VOXEL_LAYER_HOOK_ACTIONS` contains the same action vocabulary for integrations
that need a runtime list. The `"object-added"` event carries the full object in
`metadata.object`, so a remote consumer can reconstruct it without another lookup.


# VoxelDebugger.md

# VoxelDebugger

`VoxelEngine.debug` exposes a `VoxelDebugger`: live mesh statistics and an
optional wireframe view of the geometry the mesh builder produced.

```ts
import { VoxelEngine } from "@jolly-pixel/voxel.renderer";

const engine = new VoxelEngine({ layers: ["Ground"] });

// Draw the wireframe over the textured chunks.
engine.debug.mode = "overlay";

const { faces, culledFaces, triangles } = engine.debug.stats;
console.log(`${faces} faces, ${culledFaces} culled, ${triangles} triangles`);
```

Counters are collected on every chunk build, whatever the mode; only the
wireframe has an additional rendering cost.

## API

```ts
class VoxelDebugger {
  mode: VoxelDebugMode;
  enabled: boolean;
  readonly stats: VoxelDebugStats;

  constructor(
    parent: THREE.Object3D,
    options?: VoxelDebuggerOptions
  );
  nextMode(): VoxelDebugMode;
  registerChunk(
    key: string,
    meshes: readonly THREE.Mesh[],
    stats: MeshBuildStats
  ): void;
  unregisterChunk(key: string): void;
  clear(): void;
  dispose(): void;
}
```

`registerChunk()` copies the supplied statistics. Re-registering a key replaces
its meshes and counters. `unregisterChunk()` ignores unknown keys. `clear()`
removes all tracked chunks and overlays; `dispose()` also releases the debug
material.

## Modes

| Mode | Effect |
|---|---|
| `"off"` (default) | chunks render normally, nothing is added to the scene graph |
| `"overlay"` | a wireframe copy is drawn over the textured chunks |
| `"wireframe"` | the textured chunks are hidden, leaving only the wireframe |

Wireframes reuse the chunk geometries. Switching modes never re-meshes
anything and costs no extra vertex memory, only one draw call per chunk mesh.
While a mode other than `"off"` is active, a `THREE.Group` named
`"VoxelDebugger"` holds them under `engine.root`.

```ts
// Cycle off → overlay → wireframe → off, e.g. from a keybinding.
document.addEventListener("keydown", (event) => {
  if (event.code === "KeyG") {
    engine.debug.nextMode();
  }
});

// Booleans work too: `enabled = true` selects "overlay".
engine.debug.enabled = false;
```

The initial state comes from `VoxelEngineOptions.debug`:

```ts
interface VoxelDebuggerOptions {
  /** @default "off" */
  mode?: VoxelDebugMode;
  /** @default 0x66FF99 */
  color?: THREE.ColorRepresentation;
  /** Wireframe opacity, `1` disables blending. @default 0.5 */
  opacity?: number;
}
```

## Statistics

`debug.stats` sums the last build of every chunk currently meshed, so it follows
chunk rebuilds, layer removals and `load()` without ever being stale.

```ts
interface VoxelDebugStats {
  /** Chunks the mesh builder processed, including those emitting no face. */
  chunks: number;
  /** Chunk meshes attached to the scene graph, i.e. one draw call each. */
  meshes: number;
  /** Voxels visited. */
  voxels: number;
  /** Voxels skipped because a higher-priority layer covers the position. */
  hiddenVoxels: number;
  /** Faces written to a geometry. */
  faces: number;
  /** Faces skipped because an opaque neighbour occludes them. */
  culledFaces: number;
  /** Voxel faces greedy meshing folded into a neighbour's quad; 0 when off. */
  mergedFaces: number;
  vertices: number;
  triangles: number;
  /** faces / (voxels - hiddenVoxels). */
  facesPerSolidVoxel: number;
  /** Vertex attributes emitted, in bytes per vertex; indices excluded. */
  bytesPerVertex: number;
  /** Sum of the last build time of every live chunk, not a frame cost. */
  buildTimeMs: number;
}
```

`faces + culledFaces` is the number of face candidates, which makes the culling
ratio directly readable:

```ts
const { faces, culledFaces } = engine.debug.stats;
const ratio = (culledFaces / (faces + culledFaces)) * 100;
```

With [greedy meshing](../../concepts/rendering-and-meshing.md#greedy-meshing) on,
`faces` counts quads
rather than voxel faces, and `mergedFaces` is how many extra voxel faces those
quads absorbed. `faces + mergedFaces` is therefore what the naive builder would
have emitted, which makes the merge ratio readable the same way:

```ts
const { faces, mergedFaces } = engine.debug.stats;
const ratio = (mergedFaces / (faces + mergedFaces)) * 100;
```

The two derived figures are the ones worth watching for regressions:

- `facesPerSolidVoxel` should decrease when greedy meshing combines faces. If it
  does not, inspect the merge predicates and the blocks in the measured chunks.
- `bytesPerVertex` is read off the emitted geometries, not off a constant, so an
  attribute that quietly widens (or a dropped one that comes back) shows up here
  with no code change needed. The current layouts report 19 without greedy
  meshing and 35 with it. `tileRegion`, `tileRepeat`, and float tile UVs account
  for the difference.

`MeshBuildStats` holds the counters for a single chunk build. `VoxelDebugger`
keeps a copy per chunk key and aggregates them on demand.

```ts
class MeshBuildStats {
  voxels: number;
  hiddenVoxels: number;
  faces: number;
  culledFaces: number;
  mergedFaces: number;
  vertices: number;
  triangles: number;
  geometries: number;
  bytesPerVertex: number;
  buildTimeMs: number;

  readonly facesPerSolidVoxel: number;

  reset(): void;
  copyFrom(source: MeshBuildStats): void;
  clone(): MeshBuildStats;
}
```

All counters start at `0`. `facesPerSolidVoxel` is `faces` divided by
`voxels - hiddenVoxels`; it returns `0` when no voxel contributed geometry.
`reset()` clears the instance. `copyFrom()` replaces every field with another
instance's counters, and `clone()` returns an independent copy.

## Example

`examples/noise-world.html` wires both to its HUD: `G` cycles the wireframe
modes and the panel shows faces, culling ratio, triangles, vertices and chunk
meshes, refreshed four times per second.

```bash
npm run dev -w @jolly-pixel/voxel.renderer
```


# VoxelEngine.md

# VoxelEngine

Voxel world engine: manages layers, blocks, tilesets, and hooks, and builds chunked
Three.js meshes. Use it directly, or through [`VoxelRenderer`](./VoxelRenderer.md),
which exposes it as `vr.engine`.

```ts
import {
  VoxelEngine,
  VoxelRotation,
  loadTilesets
} from "@jolly-pixel/voxel.renderer";

const tilesets = await loadTilesets([
  {
    id: "default",
    src: "tileset.png",
    tileSize: 16
  }
]);

const engine = new VoxelEngine({
  tilesets,
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
   * Must be a power of two because every world-to-chunk conversion is a shift and a
   * mask. Anything else throws a RangeError.
   * @default 16
   */
  chunkSize?: number;
  /**
   * Milliseconds tick() may spend rebuilding dirty chunks before deferring the
   * rest to the next frame. 0 rebuilds everything in the same tick.
   * @default 8
   */
  rebuildBudgetMs?: number;
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
  /** Optional initial block definitions to register. */
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
   * Called for each supported voxel, layer, and object-layer mutation.
   * See Hooks.md for the event union.
   */
  onLayerUpdated?: VoxelLayerHookListener;

  /**
   * Initial state of the debug inspector (`engine.debug`). Mesh counters are
   * always collected; this only decides whether the wireframe is drawn from
   * the start. See [`VoxelDebugger`](./VoxelDebugger.md).
   */
  debug?: VoxelDebuggerOptions;

  /**
   * Texels of edge-replicated gutter added around every tile of an atlas before
   * it is bound to a material. Prevents distant geometry from sampling
   * neighbouring tiles. See [atlas padding](../../concepts/atlas-padding.md).
   * Set to 0 to render atlases untouched.
   * @default half the tile size, clamped to 2..8
   */
  tilesetPadding?: number;

  /**
   * Merge coplanar identical block faces into the largest quads possible
   * instead of one quad per voxel face.
   * See [rendering and meshing](../../concepts/rendering-and-meshing.md#greedy-meshing).
   * @default false
   */
  greedy?: boolean;

  /**
   * Pre-loaded atlases, registered synchronously during construction. Use
   * `loadTilesets()` to fetch them before constructing `VoxelEngine`.
   */
  tilesets?: Iterable<TilesetSource>;
}
```

`load()` accepts a separate options object:

```ts
interface VoxelLoadOptions {
  /** Collapse voxel layers after deserialization. */
  mergeLayers?: boolean;
  /** Atlases to register before validating the snapshot's tileset list. */
  tilesets?: Iterable<TilesetSource>;
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
  readonly debug: VoxelDebugger;

  greedy: boolean; // read/write; assigning rebuilds every chunk
  rebuildFocus: THREE.Vector3Like | null;
  readonly pendingRebuilds: number;
  onLayerUpdated: VoxelLayerHookListener | undefined;
}
```

## Lifecycle

```ts
init(): void;                   // builds meshes for any voxels already present (e.g. after deserialize)
tick(deltaTime: number): void;  // rebuilds dirty chunks within a time budget; call once per frame
flush(): void;                  // rebuilds every pending chunk now, ignoring the budget
dispose(): void;                // disposes chunk meshes, materials, and tileset textures
```

When wrapped by `VoxelRenderer`, these are called automatically from its
`awake()`/`update()`/`destroy()`. Call them yourself when using `VoxelEngine` standalone.

### Rebuild budget

`tick()` spends at most `rebuildBudgetMs` (default `8` ms) per frame and defers the rest. Set to `0` to rebuild everything synchronously. `init()` and `load()` always rebuild the whole world synchronously regardless. Use `flush()` when meshes must be ready before the next line runs.

```ts
const engine = new VoxelEngine({ rebuildBudgetMs: 8 });

engine.rebuildFocus = camera.position; // prioritize chunks near the camera
engine.pendingRebuilds;                // 0 once the world is up to date
```

The [rendering and meshing](../../concepts/rendering-and-meshing.md) concept
explains the chunk geometry layout, rebuild queue, and greedy meshing tradeoffs.

## Methods

#### `getLayer(name: string): VoxelLayer | undefined`

Returns the named layer, or `undefined` when it does not exist.

#### `cloneLayer(name: string, options: PartialExcept<VoxelLayerOptions, "name">): VoxelLayer | undefined`

Clones the named layer and adds the copy to the world. `options.name` is required.
Returns `undefined` when the source layer does not exist and fires `"cloned"` on
success.

#### `mergeLayer(sourceLayerName: string, targetLayerName: string): boolean`

Copies source voxels into the target layer. Source voxels win at overlapping world
positions. Returns `false` when either layer does not exist and fires `"merged"` on
success.

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
> See [`VoxelLayer`](../world/VoxelLayer.md) for the full semantics. Partial
> opacity does not affect collision; see [`VoxelCollider`](../collision/VoxelCollider.md).

#### `updateLayer(name: string, options: Partial<VoxelLayerConfigurableOptions>): boolean`

Updates an existing layer. Returns `false` when the name is unknown.

#### `removeLayer(name: string): boolean`

Removes the named layer. Returns `false` when it does not exist.

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

Returns the world-space center of all voxels in the given layer.

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
getVoxel(position: THREE.Vector3Like): VoxelEntry | undefined
getVoxel(layerName: string, position: THREE.Vector3Like): VoxelEntry | undefined
```

Composited read (first overload) or layer-specific read (second overload). Returns `undefined` for air.

#### `getVoxelNeighbour` overloads

```ts
getVoxelNeighbour(position: THREE.Vector3Like, face: Face): VoxelEntry | undefined
getVoxelNeighbour(layerName: string, position: THREE.Vector3Like, face: Face): VoxelEntry | undefined
```

Returns the voxel immediately adjacent to `position` in the given face direction.
Composited (first overload) or restricted to a specific layer (second overload).

#### `loadTileset(def: TilesetDefinition, texture: THREE.Texture<HTMLImageElement>): void`

Registers an already-loaded texture for a tileset definition. The first registered tileset
becomes the default for tile references with no explicit `tilesetId`.
Prefer passing `VoxelEngineOptions.tilesets` for pre-loading; use this method only when
adding a tileset after construction.

#### `save(): VoxelWorldJSON`

Serialises voxel layers, object layers, voxels, tileset metadata, and registered block
definitions to a plain JSON object.

#### `load(data: VoxelWorldJSON, options?: VoxelLoadOptions): void`

Clears the current world and restores state from a JSON snapshot. Every tileset the
snapshot references must be registered by the time the world is read, either at
construction or through `VoxelLoadOptions.tilesets`. A missing tileset throws.
Already-registered tilesets are skipped.

Embedded block definitions are registered only when their IDs are not already present.
Set `mergeLayers: true` to collapse voxel layers after deserialization.
`data.chunkSize` is metadata; `load()` keeps the engine's configured chunk size.
Construct the engine with the snapshot's chunk size when the values must match.

#### `markAllChunksDirty(source?: string): void`

Marks every chunk dirty for a later rebuild.

### Object layer API

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

#### `applyRemoteCommand(command: VoxelLayerHookEvent): void`

Applies a hook event without emitting it again through `onLayerUpdated`. Network
adapters use this method to avoid echo loops.

See [hooks](./hooks.md) for the event reference.


# VoxelRenderer.md

# VoxelRenderer

`ActorComponent` that renders a layered voxel world as chunked Three.js meshes.
Each chunk is rebuilt only when its content changes, keeping GPU work proportional to edits rather than world size.

Wraps a [`VoxelEngine`](./VoxelEngine.md) instance, exposed as `vr.engine`, and drives its
lifecycle from `awake`/`update`/`destroy`.

## API

```ts
type VoxelRendererOptions = VoxelEngineOptions;

class VoxelRenderer extends ActorComponent {
  readonly engine: VoxelEngine;

  constructor(
    actor: Actor<any>,
    options?: VoxelRendererOptions
  );
  awake(): void;
  update(deltaTime: number): void;
  destroy(): void;
}
```

The constructor uses `actor.world.logger` unless the options supply another
logger. `awake()` attaches `engine.root` to the actor and initializes the
engine. `update()` advances its rebuild queue. `destroy()` removes the root and
disposes the engine before destroying the component.

```ts
import {
  VoxelRenderer,
  loadTilesets
} from "@jolly-pixel/voxel.renderer";

// Pre-load tilesets before constructing VoxelRenderer (no async in lifecycle).
const tilesets = await loadTilesets([
  {
    id: "default",
    src: "tileset.png",
    tileSize: 16
  }
]);

const vr = actor.addComponentAndGet(VoxelRenderer, {
  tilesets,
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

## Hooks

See [hooks](./hooks.md) for more information.


# protocol.md

# Network protocol

Voxel synchronization uses engine hook events plus one administrative command.

```ts
interface VoxelWorldReplaceCommand {
  action: "world-replace";
  data: VoxelWorldJSON;
}

type VoxelNetworkCommand =
  (VoxelLayerHookEvent | VoxelWorldReplaceCommand)
  & network.NetworkCommandHeader;

type VoxelServerMessage = network.NetworkServerMessage<
  VoxelNetworkCommand,
  VoxelWorldJSON
>;
```

`NetworkCommandHeader` supplies `clientId`, `seq`, and `timestamp`. Server
messages contain either a command or a world snapshot.

## Validation

```ts
function isVoxelNetworkCommand(
  value: unknown
): value is VoxelNetworkCommand;
```

The check is deliberately shallow. It verifies only that the value is a
non-null object with `action` and `clientId` properties. Validate untrusted
payloads before they reach `VoxelSyncServer` when the room crosses a trust
boundary.

## Headless application

```ts
function applyCommandToWorld(
  world: VoxelWorld,
  command: VoxelLayerHookEvent
): void;
```

`applyCommandToWorld()` replays one mutation against a bare `VoxelWorld`. It is
used by the server and is also available to tests, offline tools, and other
headless integrations.


# VoxelCommandArbiter.md

# VoxelCommandArbiter

`VoxelCommandArbiter` tracks accepted voxel commands and delegates conflict
decisions to a `network.ConflictResolver`.

## API

```ts
interface VoxelCommandArbiterOptions {
  conflictResolver?: network.ConflictResolver<VoxelNetworkCommand>;
}

class VoxelCommandArbiter {
  constructor(options?: VoxelCommandArbiterOptions);
  resolve(command: VoxelNetworkCommand): boolean;
  record(command: VoxelNetworkCommand): void;

  static key(
    command: VoxelLayerHookEvent | VoxelNetworkCommand
  ): string | null;
}
```

The default resolver is `network.LastWriteWinsResolver`. `resolve()` reports
whether the command is accepted; it does not record the result. Call `record()`
after the command has been applied successfully.

`key()` returns `"<layer>:<x>,<y>,<z>"` for voxel placement and removal. Other
actions return `null` and therefore do not conflict by position.


# VoxelSyncClient.md

# VoxelSyncClient

`VoxelSyncClient` connects a `VoxelEngine` to a typed `network.Room`.

## API

```ts
interface VoxelSyncClientOptions {
  room: network.Room<
    VoxelNetworkCommand,
    VoxelServerMessage
  >;
}

class VoxelSyncClient extends network.SyncAdapter<
  VoxelEngine,
  VoxelLayerHookEvent,
  VoxelNetworkCommand,
  VoxelWorldJSON
> {
  constructor(options: VoxelSyncClientOptions);

  attach(engine: VoxelEngine): void;
  detach(): void;
  replaceWorld(data: VoxelWorldJSON): void;
  destroy(): void;
}
```

`attach()` chains onto the engine's current `onLayerUpdated` listener. `detach()`
restores the listener that was present at attachment time.

Incoming snapshots call `engine.load()`. Incoming mutation commands call
`engine.applyRemoteCommand()` and skip commands echoed from the same client.
`replaceWorld()` sends a stamped administrative command. `destroy()` detaches,
removes the room message listener, and calls `room.leave()`.

See [synchronizing a world](../../guides/synchronizing-a-world.md) for setup.


# VoxelSyncServer.md

# VoxelSyncServer

`VoxelSyncServer` is a `network.Extension` that owns one authoritative
`VoxelWorld`.

## API

```ts
type ClientHandle = network.ClientHandle;

interface VoxelSyncServerOptions {
  id?: string;
  world?: VoxelWorld;
  chunkSize?: number;
  conflictResolver?: network.ConflictResolver<VoxelNetworkCommand>;
}

class VoxelSyncServer extends network.Extension {
  readonly id: string;
  readonly name: "voxel.renderer";
  readonly world: VoxelWorld;
  readonly events: readonly string[];

  constructor(options?: VoxelSyncServerOptions);
  onClientConnect(client: ClientHandle): void;
  onClientDisconnect(clientId: string): void;
  getEventName(payload: unknown): string;
  onMessage(
    clientId: string,
    payload: unknown,
    context: network.RoomContext
  ): void;
  receive(
    command: VoxelNetworkCommand,
    context: network.RoomContext
  ): void;
  snapshot(): VoxelWorldJSON;
}
```

`id` defaults to `"voxel-map"`. When `world` is omitted, the server creates one
with `chunkSize`, which defaults to `16`.

`onClientConnect()` sends the current snapshot. `onMessage()` performs the
shallow command-marker check before calling `receive()`. Invalid mutations and
world replacements are logged and dropped.

`name` provides the rights namespace. `events` contains the layer hook action
vocabulary but excludes `"world-replace"`. `snapshot()` serializes the world
without tileset metadata or block definitions.


# serialization.md

# Serialization

The serialization API defines the persisted world shape, converts live worlds,
and validates voxel documents received as objects or UTF-8 JSON bytes. Most
applications use `VoxelEngine.save()` and `VoxelEngine.load()`, which also
update materials and chunk meshes.

## World document

```ts
type VoxelEntryKey = `${number},${number},${number}`;

interface VoxelEntryJSON {
  block: number;
  transform: number;
}

interface VoxelLayerJSON {
  id: string;
  name: string;
  visible: boolean;
  opacity?: number;
  order: number;
  offset?: VoxelCoord;
  properties?: Record<string, any>;
  voxels: Record<VoxelEntryKey, VoxelEntryJSON>;
}

interface VoxelWorldJSON {
  version: 1;
  chunkSize: number;
  tilesets: TilesetDefinition[];
  layers: VoxelLayerJSON[];
  blocks?: ResolvedBlockDefinition[];
  objectLayers?: VoxelObjectLayerJSON[];
}
```

Voxel keys contain world-space coordinates, including the layer offset. Older
documents without `opacity` or `offset` load with opacity `1` and a zero offset.

`blocks` contains definitions embedded by `VoxelEngine.save()` or a converter.
`objectLayers` stores placed objects such as spawn points and trigger zones.

## Serializing a world

```ts
interface VoxelSerializeOptions {
  tilesets?: Iterable<TilesetDefinition>;
  blocks?: Iterable<ResolvedBlockDefinition>;
}

function serializeVoxelWorld(
  world: VoxelWorld,
  options?: VoxelSerializeOptions
): VoxelWorldJSON;
```

The world does not own loaded tileset metadata or the block registry, so callers
pass those collections explicitly. `blocks` is omitted when it is not supplied.

## Deserializing a world

```ts
interface VoxelDeserializeOptions {
  blocks?: BlockRegistry;
}

function deserializeVoxelWorld(
  data: VoxelWorldJSON,
  world: VoxelWorld,
  options?: VoxelDeserializeOptions
): void;
```

The function validates `data`, then replaces the world's voxel and object
layers. It throws `InvalidVoxelDocumentError` when the document is malformed or
its chunk size differs from the target world. The target is left unchanged on
those failures.

Embedded block definitions are registered when `options.blocks` is supplied.
Existing IDs are kept, so local definitions take precedence.

See [saving and loading worlds](../../guides/saving-and-loading-worlds.md) for
the application workflow.

## Document codec

The document codec validates unknown input and converts voxel documents to or
from UTF-8 JSON bytes.

```ts
function parseVoxelDocument(value: unknown): VoxelWorldJSON;

function encodeVoxelDocument(
  document: VoxelWorldJSON
): Uint8Array;

function decodeVoxelDocument(
  data: Uint8Array
): VoxelWorldJSON;

class InvalidVoxelDocumentError extends Error {
  constructor(
    reason: string,
    options?: { cause?: unknown }
  );
}
```

`parseVoxelDocument()` requires version `1`, a positive integer `chunkSize`,
and a `layers` array. A missing or malformed `tilesets` value becomes an empty
array. Malformed `blocks` and `objectLayers` values are omitted. Unknown
top-level keys are discarded.

The parser validates the top-level document shape. Collection elements are
checked later while the world is deserialized; malformed layer or voxel entries
are skipped there.

`encodeVoxelDocument()` returns UTF-8 JSON bytes. `decodeVoxelDocument()` parses
those bytes and then applies `parseVoxelDocument()`. All three functions throw
`InvalidVoxelDocumentError`; decoding errors are available through its `cause`.

## Voxel objects

Object layers hold placed objects such as spawn points and trigger zones. Their
coordinates use voxel or tile space and may contain fractional values.

```ts
type VoxelObjectProperties = Record<
  string,
  string | number | boolean
>;

interface VoxelObjectJSON {
  id: string;
  name: string;
  type?: string;
  x: number;
  y: number;
  z: number;
  width?: number;
  height?: number;
  rotation?: number;
  visible: boolean;
  color?: string;
  locked?: boolean;
  properties?: VoxelObjectProperties;
}

interface VoxelObjectLayerJSON {
  id: string;
  name: string;
  visible: boolean;
  order: number;
  objects: VoxelObjectJSON[];
}
```

Only string, number, and boolean property values survive serialization.

### Footprint helpers

```ts
interface VoxelObjectFootprint {
  width: number;
  height: number;
}

function normalizeVoxelExtent(value: number): number;

function voxelObjectFootprint(
  object: VoxelObjectJSON
): VoxelObjectFootprint;
```

`normalizeVoxelExtent()` rounds a finite extent to the nearest whole voxel and
clamps it to at least `1`. Invalid, zero, and negative values become `1`.

`voxelObjectFootprint()` applies that rule to the object's width and height.
Missing dimensions occupy one cell. Width spans x and height spans z.


# TiledConverter.md

# TiledConverter

`TiledConverter` converts a Tiled JSON map into `VoxelWorldJSON`.

- Tile layers become voxel layers.
- Object layers become voxel object layers.
- Group layers are flattened recursively.

Generated block definitions are embedded in the result so `VoxelEngine.load()`
can register them.

## API

```ts
interface TiledConverterOptions {
  resolveTilesetSrc: (
    tiledSource: string,
    tilesetId: string
  ) => string;
  chunkSize?: number;
  layerMode?: "flat" | "stacked";
  defaultShapeId?: BlockShapeID;
  collidable?: boolean;
}

class TiledConverter {
  convert(
    map: TiledMap,
    options: TiledConverterOptions
  ): VoxelWorldJSON;
}
```

`chunkSize` defaults to `16`. `layerMode` defaults to `"flat"`, which writes
every tile layer at y = 0. In `"stacked"` mode, each tile layer uses its flattened
layer index as y. Generated blocks default to the `"cube"` shape and are
collidable unless configured otherwise.

`resolveTilesetSrc()` maps a Tiled `.tsx` source and derived tileset ID to the
image URL stored in `TilesetDefinition.src`. Embedded tilesets pass an empty
source string.

Infinite maps and compressed tile data are not supported. The converter throws
when it encounters either form.

## Tiled JSON types

The plugin exports the JSON declarations used by `TiledConverter`. Field names
match Tiled 1.11.x JSON so a parsed `.tmj` value can be typed without an adapter.

`TiledMap` is the root document. Its `layers` field contains `TiledAnyLayer`:

```ts
type TiledAnyLayer =
  | TiledTileLayer
  | TiledObjectLayer
  | TiledImageLayer
  | TiledGroupLayer;
```

`TiledTileLayer` stores GID cells or encoded data. `TiledObjectLayer` stores
`TiledObject` values. `TiledImageLayer` refers to a standalone image, while
`TiledGroupLayer` recursively contains more layers. `TiledChunk` represents
chunk data from an infinite map; the converter rejects that form.

`TiledGID` is a numeric global tile ID. `TiledCell` is an alias for a GID or the
empty value `0` used in layer data.

### Objects and properties

`TiledObject` may contain a polygon or polyline of `TiledPoint` values, a
`TiledText` value, a tile GID, or primitive geometry. `TiledObjectTemplate`
represents a separate template document.

Custom properties use these exports:

```ts
interface TiledPropertyBase {
  name: string;
  type?: TiledPropertyType;
  propertytype?: string;
}

type TiledPropertyType =
  | "string"
  | "int"
  | "float"
  | "bool"
  | "color"
  | "file"
  | "object"
  | "class";

type TiledProperties = TiledProperty[];
```

`TiledProperty` is a discriminated union that pairs each property type with its
value type.

### Tilesets

`TiledMapTileset` is a map-level tileset entry and may point to an external
source. `TiledTileset` is the root of a standalone tileset document. Both extend
`TiledTilesetCommon`.

The tileset declarations also export:

- `TiledTile`, `TiledFrame`, `TiledGrid`, and `TiledTileOffset`.
- `TiledTransformations` and `TiledTerrain`.
- `TiledWangSet`, `TiledWangColor`, and `TiledWangTile`.

Import all of these types from
`@jolly-pixel/voxel.renderer/plugins/tiled/index.js`.

See [importing a Tiled map](../../guides/importing-a-tiled-map.md) for direct and
asset-backed loading examples.


# TiledMapAssetLoader.md

# TiledMapAssetLoader

`TiledMapAssetLoader` converts a Tiled map and prepares its atlas textures as one
`@jolly-pixel/asset` value.

## API

```ts
type TiledMapAssetLoaderOptions = Omit<
  TiledConverterOptions,
  "resolveTilesetSrc"
>;

interface VoxelTiledMap {
  readonly world: VoxelWorldJSON;
  readonly tilesets: TilesetSource[];
}

const TiledMapAssetType: AssetType<VoxelTiledMap>;

type VoxelTiledMapAsset = AssetReference<VoxelTiledMap>;

class TiledMapAssetLoader implements AssetLoader<VoxelTiledMap> {
  constructor(
    manager?: THREE.LoadingManager,
    options?: TiledMapAssetLoaderOptions
  );

  load(record: AssetRecord): Promise<VoxelTiledMap>;
}
```

The loader fetches the `.tmj` record, converts it, and loads every referenced
tileset. A `.tsx` reference is resolved to a `.png` file beside the map source.
Its default layer mode is `"stacked"`; direct `TiledConverter` calls default to
`"flat"`.

Register `TiledMapAssetType` and the loader with the runtime asset system. The
returned `world` and `tilesets` can be passed directly to `VoxelRenderer` and
`VoxelEngine.load()`.


# tilesets.md

# Tilesets

Tileset definitions describe atlas images. `loadTilesets()` fetches those
images, `TilesetManager` registers them, and `TilesetAtlas` provides the texture
and UV data used by materials.

## Definitions and tile references

```ts
interface TilesetDefinition {
  id: string;
  src: string;
  tileSize: number;
  cols?: number;
  rows?: number;
}

type ResolvedTilesetDefinition = TilesetDefinition & {
  cols: number;
  rows: number;
};

function resolveTilesetDefinition(
  definition: TilesetDefinition,
  size: AtlasSize
): ResolvedTilesetDefinition;
```

Tiles are square and `tileSize` is measured in pixels. Missing row and column
counts are derived from the image dimensions. Partial tiles at an image edge
are excluded by flooring the result. Explicit counts are preserved.

```ts
interface ResolvedTileRef {
  col: number;
  row: number;
  tilesetId?: string;
}

type Coords = [col: number, row: number];
type TileRef = Coords | ResolvedTileRef;

function resolveTileRef(
  reference: TileRef,
  defaultTilesetId?: string
): ResolvedTileRef;
```

A missing `tilesetId` selects the first registered tileset. `resolveTileRef()`
expands tuple references and fills the default ID without mutating the input.

The supporting texture and atlas types are:

```ts
interface AtlasSize {
  width: number;
  height: number;
}

interface TilesetUVRegion {
  offsetU: number;
  offsetV: number;
  scaleU: number;
  scaleV: number;
}

type TilesetImage = HTMLImageElement | HTMLCanvasElement;
type TilesetTexture = THREE.Texture<TilesetImage>;

interface AtlasLayout {
  cols: number;
  rows: number;
  tileSize: number;
  padding: number;
}

interface AtlasRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

`AtlasLayout` describes the render atlas after optional padding. `AtlasRegion`
uses source-image texels and limits an incremental repad operation.

## Loading textures

Use `loadTilesets()` before constructing a `VoxelEngine` or `VoxelRenderer`.

```ts
interface TilesetSource {
  def: TilesetDefinition;
  texture: THREE.Texture<HTMLImageElement>;
}

interface TextureSourceLoader {
  loadAsync(
    url: string
  ): Promise<THREE.Texture<HTMLImageElement>>;
}

interface LoadTilesetsOptions {
  manager?: THREE.LoadingManager;
  loader?: TextureSourceLoader;
}

function loadTilesets(
  definitions: Iterable<TilesetDefinition>,
  options?: LoadTilesetsOptions
): Promise<TilesetSource[]>;
```

Definitions are fetched in parallel. A duplicate ID is fetched once. The
optional `manager` reports Three.js loading progress; `loader` allows callers
to supply a compatible texture loader. Pass the result through
`VoxelEngineOptions.tilesets`.

The [loading and restoring tilesets guide](../../guides/loading-and-restoring-tilesets.md)
shows initial loading and saved-world restoration.

## `TilesetManager`

`VoxelEngine.tilesetManager` exposes the manager used to register loaded atlas
textures.

```ts
interface TilesetManagerOptions {
  padding?: number;
}

class TilesetManager {
  readonly defaultTilesetId: string | null;
  readonly version: number;

  constructor(options?: TilesetManagerOptions);
  registerTexture(
    definition: TilesetDefinition,
    texture: THREE.Texture<HTMLImageElement>
  ): TilesetAtlas;
  atlas(tilesetId?: string): TilesetAtlas;
  has(tilesetId?: string): boolean;
  definitions(): ResolvedTilesetDefinition[];
  dispose(): void;
}
```

The first registered tileset becomes the default for references without a
`tilesetId`. `registerTexture()` resolves missing grid dimensions and prepares
the render atlas.

`atlas()` returns the selected atlas or the default. It throws when no tileset
is registered or the requested ID is unknown. `has()` performs the same lookup
without throwing.

`version` increments when registrations change so cached UV data can be
invalidated. `dispose()` disposes every atlas and clears the manager.

`padding` controls the gutter added around each tile. Its default is half the
tile size, clamped from 2 through 8 texels. Set it to `0` to keep source atlases
unchanged. See [atlas padding](../../concepts/atlas-padding.md).

## `TilesetAtlas`

`TilesetAtlas` owns one registered atlas, its resolved grid, and the source and
render textures. Obtain it from `TilesetManager.atlas()`.

```ts
class TilesetAtlas {
  readonly def: ResolvedTilesetDefinition;
  readonly layout: AtlasLayout;
  readonly sourceTexture: TilesetTexture;
  readonly texture: TilesetTexture;

  constructor(
    definition: TilesetDefinition,
    texture: THREE.Texture<HTMLImageElement>,
    padding?: number | null
  );
  uvFor(col: number, row: number): TilesetUVRegion;
  updateSource(
    image: TilesetImage,
    bounds?: AtlasRegion
  ): void;
  dispose(): void;
}
```

An omitted or `null` padding value uses the default for the tile size. The
constructor applies nearest-neighbour filtering, sRGB color space, and disables
mipmap generation on the render texture.

`sourceTexture` preserves the original atlas grid used by editing tools.
`texture` is bound to materials and may contain padded cells. `uvFor()` returns
coordinates for the render texture.

`updateSource()` replaces the source image and rebuilds the padded texture. The
new image must keep the dimensions used at registration. Both texture objects
are updated in place, so existing materials stay valid.

Pass `bounds` for an editor update that changed only part of the source atlas.
The rectangle uses source texels and redraws only intersecting tiles. Omit it
for a complete replacement, resize, or tileset switch.

```ts
const atlas = engine.tilesetManager.atlas();
const dirty = bridge.consume();

if (dirty !== null) {
  atlas.updateSource(editor.textureCanvas(), dirty);
}
```

`dispose()` disposes both textures.


# VoxelChunk.md

# VoxelChunk

Fixed-size, sparse 3D grid of voxel data. Chunk coordinates `(cx, cy, cz)` are in
**chunk space**. Multiply by `chunkSize` to get the world-space origin.

```ts
const DEFAULT_CHUNK_SIZE = 16;
```

## Storage

Voxels are stored as packed 32-bit integers in a [`VoxelStore`](./VoxelStore.md), not as
`{ blockId, transform }` objects. Keys and values live in typed arrays, avoiding one
heap object per stored voxel.

Two consequences for callers:

- `get()`, `getAt()` and `entries()` **rebuild** a `VoxelEntry` on each call. They no
  longer return the object that was written, so compare with a deep equality check,
  never `===`.
- Block ids must fit in 23 bits (`1..MAX_BLOCK_ID`, 8 388 607). `packVoxel()` throws a
  `RangeError` above that rather than truncating silently, and on id `0`, which is
  air and has no packed form (see [air](../blocks/BlockDefinition.md#air)).

The `Packed` variants below skip the object entirely and are what the mesh builders
use.

### Packed voxel values

Chunks encode a block ID and transform byte in one non-negative 32-bit integer.

```ts
type PackedVoxel = number;

const MAX_BLOCK_ID: number; // 8_388_607
const VOXEL_ABSENT: number; // -1

function packVoxel(
  blockId: number,
  transform: number
): PackedVoxel;

function unpackVoxel(packed: PackedVoxel): VoxelEntry;
function voxelBlockId(packed: PackedVoxel): number;
function voxelTransform(packed: PackedVoxel): number;
```

`packVoxel()` stores the transform in bits 0 through 7 and the block ID in bits
8 through 30. It throws `RangeError` for air (`0`), a negative ID, or an ID
greater than `MAX_BLOCK_ID`.

`VOXEL_ABSENT` is returned by packed read methods when no voxel exists. Every
stored `PackedVoxel` is non-negative, so `packed < 0` is a valid absence check.

## Constructor

```ts
new VoxelChunk(
  [cx, cy, cz]: [number, number, number],
  size?: number
)
```

> [!NOTE]
> Chunk has a default size of 16. `size` must be a power of two because
> `linearIndex()` composes the three local coordinates into disjoint bit fields.
> Anything else throws a `RangeError`.

## Properties

```ts
class VoxelChunk {
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;

  // side length in voxels, always a power of two
  readonly size: number;
  // log2(size) and size - 1, for callers doing their own index math
  readonly shift: number;
  readonly mask: number;

  // set true on any write; cleared by VoxelEngine when the chunk is queued
  // for rebuild, so an edit during the rebuild is not swallowed
  dirty: boolean;

  readonly voxelCount: number;

  // low-level backing storage; prefer the chunk accessors
  readonly store: VoxelStore;
}
```

## Methods

```ts
type VoxelLinearCoords = [number, number, number];
```

### `get(coords: VoxelLinearCoords): VoxelEntry | undefined`

### `getAt(lx: number, ly: number, lz: number): VoxelEntry | undefined`

Same lookup as `get()` without the tuple.

### `getPackedAt(lx: number, ly: number, lz: number): PackedVoxel`

Allocation-free lookup returning the packed integer, or `VOXEL_ABSENT` (`-1`) when the
position is empty. This is what the mesh builder calls once per voxel face.

### `set(coords: VoxelLinearCoords, entry: VoxelEntry): void`

### `setPackedAt(lx: number, ly: number, lz: number, packed: PackedVoxel): void`

### `mayContain(lx: number, ly: number, lz: number): boolean`

`false` when the position is provably empty, using a conservative bounding box
of every written voxel. A `true` result still needs a `getAt()` to confirm.
The box only grows. `delete()` never shrinks it, so the result stays valid at
the cost of becoming loose after erasures.

### `delete(coords: VoxelLinearCoords): boolean`

Removes the voxel and returns `true`; returns `false` when the position was already
empty.

### `isEmpty(): boolean`

### `entries(): IterableIterator<[number, VoxelEntry]>`

Iterates all stored entries as `[linearIndex, VoxelEntry]` pairs. Allocates a tuple and
an entry object per voxel.

### `packedEntries(): IterableIterator<[number, PackedVoxel]>`

Same walk, yielding the packed integer instead of an entry object.

### `linearIndex(lx: number, ly: number, lz: number): number`

Converts local chunk coordinates to the flat key used for sparse storage.

### `fromLinearIndex(idx: number): { lx: number; ly: number; lz: number }`

Inverse of `linearIndex`.

### `toString(): string`

Returns the chunk key as `"cx,cy,cz"`.

The low-level sparse backing store has a separate
[`VoxelStore`](./VoxelStore.md) reference.


# VoxelLayer.md

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
  id: string;
  name: string;
  order: number;
  visible: boolean;
  opacity: number;
  wasVisible: boolean;

  // number of currently allocated chunks
  readonly chunkCount: number;

  // world-space translation applied to every voxel in the layer
  offset: VoxelCoord;
  properties: Record<string, any>;
}
```

These properties are mutable in the TypeScript API because deserialization and
world management update them. Application code should use the corresponding
`VoxelWorld` or `VoxelEngine` methods so mesh invalidation and hooks still run.

> **`offset`** - shifts where voxels render in world space; does not move chunk storage. Always use `VoxelWorld.setLayerOffset` or `translateLayer` so chunks are marked dirty.

> **`opacity`** - `1` = fully opaque (default), `0` = hidden (same as `visible = false`). Values below `0` or above `1` are clamped. Semi-transparent layers (`0 < opacity < 1`) skip face occlusion but are still solid for collision. Always use `VoxelWorld.setLayerOpacity` or `updateLayer` to apply changes.

> **`opacity` + `alphaTest`** - if `opacity` drops to or below `alphaTest` (default `0.1`) the layer disappears entirely instead of fading.

## Methods

### toJSON(): VoxelLayerJSON

Returns the serializable layer state.

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
> Used by `serializeVoxelWorld()`. See
> [serialization](../serialization/serialization.md).

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
Returns a freshly built `VoxelEntry`, or `undefined` if empty. See the
[storage note](./VoxelChunk.md#storage) on why the result is never `===` what was written.

```ts
const entry = layer.getVoxelAt({ x: 10, y: 5, z: 0 });
```

### getPackedVoxelAt(position: Vector3Like): PackedVoxel

Allocation-free `getVoxelAt`, returning `VOXEL_ABSENT` (`-1`) for air.

### setVoxelAt(position: Vector3Like, entry: VoxelEntry): void

Set a voxel at world-space `position`. Allocates a chunk if necessary and marks it dirty for rebuild.

```ts
layer.setVoxelAt({ x: 0, y: 0, z: 0 }, { blockId: 3, transform: 0 });
```

### setPackedVoxelAt(position: Vector3Like, packed: PackedVoxel): void

Allocation-free `setVoxelAt`, taking the value `packVoxel()` produces.

### removeVoxelAt(position: Vector3Like): void

Remove the voxel at the given world-space `position`. If the containing chunk becomes empty it is freed.

```ts
layer.removeVoxelAt({ x: 0, y: 0, z: 0 });
```

### centerToWorld(): Vector3 | null

Returns the world-space center of all voxels in the given layer, accounting for the layer offset.
When the layer has no voxels the layer offset itself is returned as a `Vector3`.
Every current implementation path returns a `Vector3`; the public declaration
remains nullable.

### markChunkDirty(cx: number, cy: number, cz: number): void

Mark the chunk at the given chunk coordinates as dirty so it will be rebuilt.

```ts
layer.markChunkDirty(0, 0, 0);
```

### getChunks(): IterableIterator<VoxelChunk>

Iterate allocated chunks in this layer.

```ts
for (const chunk of layer.getChunks()) {
  // process chunk
}
```

### clone(options?: Partial<VoxelLayerOptions>): VoxelLayer

Creates a detached copy of the layer, including its voxels and properties. Use
`VoxelWorld.cloneLayer()` or `VoxelEngine.cloneLayer()` when the clone should be
added to a world.

### mergeFrom(source: VoxelLayer): void

Copies every voxel from `source` into this layer. Source voxels overwrite target
voxels at the same world position. Prefer the world or engine merge method when
the operation must update world state or emit hooks.

### drainPendingRemovals(): IterableIterator<VoxelChunk>

Consumes chunks that became empty and were removed from storage. Renderers use
this iterator to dispose stale meshes; ordinary callers rarely need it.


# VoxelStore.md

# VoxelStore

`VoxelStore` is the sparse `linearIndex` to `PackedVoxel` map used by
[`VoxelChunk`](./VoxelChunk.md). It uses typed arrays, open addressing, and
linear probing.

## API

```ts
class VoxelStore {
  readonly size: number;
  readonly capacity: number;
  readonly keys: Int32Array;
  readonly values: Uint32Array;

  constructor(initialCapacity?: number);
  get(key: number): PackedVoxel;
  has(key: number): boolean;
  set(key: number, value: PackedVoxel): boolean;
  delete(key: number): boolean;
  clear(): void;
}
```

`initialCapacity` defaults to `16` and is rounded up to a power of two, with a
minimum capacity of `16`.

`get()` returns `VOXEL_ABSENT` when the key is missing. `set()` returns `true`
when it inserts a new key and `false` when it replaces an existing value.

The store grows at a three-quarter load factor. Deletion shifts the following
probe cluster back instead of leaving tombstones.

## Direct iteration

`keys` and `values` are exposed for hot loops that must avoid iterator and object
allocation. Their arrays are replaced when the store grows. Slots containing a
voxel have a non-negative key.

```ts
const { keys, values, capacity } = chunk.store;

for (let slot = 0; slot < capacity; slot++) {
  const linearIndex = keys[slot];
  if (linearIndex < 0) {
    continue;
  }

  const blockId = voxelBlockId(values[slot]);
}
```


# VoxelWorld.md

# VoxelWorld

`VoxelWorld` owns voxel layers, object layers, and chunk lifecycle. Read
[the world model](../../concepts/world-model.md) for the ownership and compositing
rules.

## Values and coordinates

The world API uses these value types for positions and voxel contents:

```ts
interface VoxelCoord {
  x: number;
  y: number;
  z: number;
}

interface VoxelEntry {
  blockId: number;
  transform: number;
}
```

Any `THREE.Vector3Like` is accepted where a method expects `VoxelCoord`.
`VoxelEntry.blockId` refers to `BlockDefinition.id`; `0` means air and is never
stored. The maximum block ID is 8,388,607.

`VoxelEntry` is a value type. Chunks store packed integers and build a new object
for each unpacked read, so compare entries by value instead of identity. The
packed API on [`VoxelChunk`](./VoxelChunk.md#packed-voxel-values) avoids that
allocation on hot paths.

### `voxelCellOf(point)`

```ts
function voxelCellOf(point: VoxelCoord): VoxelCoord;
```

Returns the whole cell containing `point`. Cells use half-open spans and the
function floors each component. `{ x: 3.5, y: 0.5, z: 4.5 }` resolves to
`{ x: 3, y: 0, z: 4 }`; `{ x: -0.2, y: 0, z: 0 }` resolves to x = -1.

### `voxelPositionOf(point, normal, side?)`

```ts
function voxelPositionOf(
  point: VoxelCoord,
  normal: VoxelCoord,
  side?: "front" | "back"
): VoxelCoord;
```

Returns the cell on one side of a surface, for example after a raycast hit.
`"front"` is the empty cell the surface faces and is the default. `"back"` is
the cell that owns the surface. Neither argument is modified.

## `VoxelWorld`

Top-level container for a layered voxel scene. Layers are composited from highest `order`
to lowest. The first visible layer with `opacity > 0` that has a voxel at a given position
wins. This allows decorative layers to override base terrain non-destructively.
A layer with `opacity === 0` is skipped during compositing exactly like an invisible one.

### Constructor

```ts
new VoxelWorld(chunkSize?: number) // default: 16
```

`chunkSize` must be a power of two. Every world-to-chunk conversion (on the
write path, in the mesher, and in neighbour lookups) is a shift and a mask.
Other sizes throw a `RangeError`.

### Properties

```ts
readonly chunkSize: number;
```

### Methods

#### `addLayer(name: string, options?: VoxelLayerConfigurableOptions): VoxelLayer`

Creates and appends a new layer with the next available `order`.

#### `updateLayer(name: string, options: Partial<VoxelLayerConfigurableOptions>): boolean`

Updates visibility, opacity, or properties. Returns `false` when the layer does
not exist.

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
`offset`: a voxel stored at local `{0,0,0}` will appear at `{offset.x, offset.y, offset.z}`
in world space. Marks all chunks in every layer dirty so cross-layer face culling is
re-evaluated on the next frame. No-op if the layer is not found.

#### `translateLayer(name: string, delta: VoxelCoord): void`

Adds `delta` to the layer's current offset. Equivalent to calling `setLayerOffset` with
`layer.offset + delta`. Marks all chunks dirty. No-op if the layer is not found.

#### `getLayer(name: string): VoxelLayer | undefined`

#### `getLayers(): readonly VoxelLayer[]`

All layers, sorted highest `order` first.

#### `cloneLayer(name: string, options: PartialExcept<VoxelLayerOptions, "name">): VoxelLayer | undefined`

Clones a layer and adds the copy to the world. `options.name` is required. Other
layer options can override the source values. Returns `undefined` when the source
layer does not exist.

#### `mergeLayer(sourceName: string, targetName: string): boolean`

Copies the source voxels into the target. Source voxels overwrite target voxels at
the same world position. Returns `false` when either layer does not exist. The source
layer remains in the world.

#### `mergeAllLayers(): VoxelLayer | null`

Collapses all voxel layers into the lowest-order layer. Higher-order voxels win at
overlapping world positions, and every other voxel layer is removed. Returns `null`
for an empty world.

#### `getVoxelAt(position: THREE.Vector3Like): VoxelEntry | undefined`

Composited read. Returns the voxel from the highest-priority visible layer (`opacity > 0`)
at that position. Returns `undefined` for air.

#### `getPackedVoxelAt(position: THREE.Vector3Like): PackedVoxel`

Allocation-free `getVoxelAt`, returning `VOXEL_ABSENT` (`-1`) for air.

#### `getVoxelWithLayerAt(position: THREE.Vector3Like): { entry: VoxelEntry; layer: VoxelLayer } | undefined`

Same compositing rules as `getVoxelAt`, but also returns the owning `VoxelLayer` so callers
can inspect layer-level properties (e.g. `opacity`) of the resolved voxel.

#### `getVoxelNeighbour(position: THREE.Vector3Like, face: Face): VoxelEntry | undefined`

Composited read of the voxel immediately adjacent to `position` in the given face direction.

#### `setVoxelAt(layerName: string, position: THREE.Vector3Like, entry: VoxelEntry): void`

#### `setPackedVoxelAt(layerName: string, position: THREE.Vector3Like, packed: PackedVoxel): void`

Writes a voxel directly and marks neighbouring chunks dirty for boundary face re-evaluation.
Throws if the layer is not found. Prefer `VoxelEngine.setVoxel` to handle rotation packing.

#### `removeVoxelAt(layerName: string, position: THREE.Vector3Like): void`

Removes a voxel. No-op if the layer is not found.

#### `getAllChunks(): IterableIterator<IterableLayerChunk>`

Iterates over every chunk across all layers.

#### `getAllDirtyChunks(): IterableIterator<IterableLayerChunk>`

Iterates over chunks whose `dirty` flag is set.

```ts
interface IterableLayerChunk {
  layer: VoxelLayer;
  chunk: VoxelChunk;
}
```

#### `getAllChunksToBeRemoved(): IterableIterator<IterableLayerChunk>`

Consumes chunks whose meshes must be removed because their layer disappeared or
the chunk became empty. This is renderer-facing lifecycle plumbing.

#### `clear(): void`

Removes all voxel layers and object layers.

### Object layer management

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


# atlas-padding.md

# Atlas padding

Voxel-renderer surrounds each atlas tile with replicated edge texels before it
binds the texture to a material. The gutter prevents filtered samples near a
triangle edge from reading a neighbouring tile.

MSAA can shade a partially covered pixel at a point outside the triangle. The
interpolated UV may then extend past the intended tile. A gutter makes that
sample land on a copy of the tile's own border.

## Default padding

Padding defaults to half the tile size, clamped from 2 through 8 texels. Set
`VoxelEngineOptions.tilesetPadding` to `0` to disable repacking.

```ts
const engine = new VoxelEngine({
  tilesets,
  tilesetPadding: 4
});
```

The render texture grows by `2 * padding` in each dimension for every cell. A
16 px tile with 8 px of padding therefore uses a 32 px render cell. Source
atlases are normally small, but editing tools should account for that extra GPU
memory.

## Source and render textures

`TilesetAtlas.sourceTexture` keeps the original grid. `texture` contains the
padded atlas and is the texture used by chunk materials. `uvFor()` always
returns coordinates for `texture`.

Use `updateSource()` after editing the original grid. A bounded update limits
the redraw to tiles intersecting the supplied source-image rectangle.

## Environments without canvas

Repacking requires a 2D canvas. In Node.js or SSR environments without one,
the atlas remains unpadded: `layout.padding` is `0`, `texture` aliases
`sourceTexture`, and UVs use the original grid.


# network-synchronization.md

# Network synchronization

The network integration sends `VoxelEngine` hook events through a room and
applies accepted commands to an authoritative `VoxelWorld`.

```text
VoxelEngine -> VoxelSyncClient -> network.Room
                                      |
                                      v
network clients <- network.Server <- VoxelSyncServer
```

## Command flow

1. A local engine mutation emits a `VoxelLayerHookEvent`.
2. `VoxelSyncClient` stamps it with a client ID, sequence, and timestamp, then
   sends it through the room.
3. `VoxelSyncServer` validates the marker fields, resolves conflicts, applies
   the command to its world, and broadcasts the accepted command.
4. Each client applies the remote command through `engine.applyRemoteCommand()`.

The engine suppresses its hook while applying a remote command, which prevents
the received mutation from being sent back to the server.

## Snapshots

A newly connected client receives a full `VoxelWorldJSON` snapshot. The server
owns voxel and object-layer state but does not load render resources, so its
snapshot has no tileset or block definitions. Clients prepare those resources
before joining.

`"world-replace"` replaces the authoritative state and broadcasts another
snapshot. It bypasses conflict arbitration.

## Conflict resolution

The default `LastWriteWinsResolver` compares commands for the same layer and
voxel position. A later timestamp wins. Equal timestamps use the lexicographically
greater client ID. Commands from the same client as the accepted command remain
valid even when their timestamps move backwards, which supports replayed undo
and redo operations.

Only `"voxel-set"` and `"voxel-removed"` commands have a position conflict key.
Layer structure, object-layer commands, and full-world replacement are not
arbitrated.

[`VoxelCommandArbiter`](../api/network/VoxelCommandArbiter.md) accepts a custom
`network.ConflictResolver` when an integration needs another policy.


# rendering-and-meshing.md

# Rendering and meshing

`VoxelEngine` turns dirty chunks into Three.js meshes. A write marks the affected
chunk and any boundary neighbours dirty. `tick()` rebuilds that queue within the
configured time budget, while `flush()` rebuilds it immediately.

See the [`VoxelEngine` reference](../api/core/VoxelEngine.md) for lifecycle methods
and configuration.

## Chunk geometry layout

Each chunk has one `THREE.Mesh` per tileset and cutout mode, parented to
`VoxelEngine.root`. The standard layout uses 19 bytes per vertex:

| Attribute | Type | Items | Bytes | Notes |
|---|---|---:|---:|---|
| `position` | `float32` | 3 | 12 | Absolute world space |
| `normal` | normalized `int8` | 3 | 3 | Supports non-axis-aligned faces |
| `uv` | normalized `uint16` | 2 | 4 | Atlas coordinates |

Vertices are not shared between faces, so a cube has 24 vertices. `position`
remains `float32` because raycasting and `mergeChunkGeometries()` read it
directly. Layer opacity is stored on materials. Materials are cached in 32
opacity buckets.

## Rebuild scheduling

`tick()` spends at most `rebuildBudgetMs` on dirty chunks during one frame.
The default is 8 ms. A value of `0` rebuilds the entire queue. `rebuildFocus`
prioritizes chunks near a camera or other point of interest.

`init()` and `load()` rebuild the complete world synchronously. Use `flush()`
when callers need current meshes before continuing.

## Greedy meshing

With `greedy: true`, adjacent identical faces are merged into the largest
available rectangle. Merging stays inside one chunk and applies to full, flat
faces such as cubes and slabs. Slopes, poles, and transformed voxels remain
separate.

Greedy mode uses 35 bytes per vertex:

| Attribute | Type | Items | Bytes | Notes |
|---|---|---:|---:|---|
| `uv` | `float32` | 2 | 8 | Tile space (`0..span`) |
| `tileRegion` | normalized `uint16` | 4 | 8 | Atlas offset and scale |
| `tileRepeat` | `uint16` | 2 | 4 | Repeat count per axis |

The extra attributes let the shader repeat one atlas tile across a merged face.
A `materialCustomizer` that replaces `onBeforeCompile` or remaps texture UVs
conflicts with this shader modification.

Greedy meshing allocates a scratch grid proportional to `chunkSize³`. Large
chunks increase that cost, and the approach does not support per-vertex lighting
or ambient occlusion.

```ts
const engine = new VoxelEngine({
  chunkSize: 32,
  greedy: true
});

// Changing the mode rebuilds every chunk and replaces the materials.
engine.greedy = false;
```

### Tile wrapping for custom materials

Greedy meshing uses tile-space UVs across merged faces. `enableTileWrapping()`
modifies a supported custom material so one atlas cell repeats instead of
stretching.

```ts
type TileWrappedMaterial =
  | THREE.MeshLambertMaterial
  | THREE.MeshStandardMaterial;

function enableTileWrapping(
  material: TileWrappedMaterial
): void;
```

The material must already have a `map`. The function does nothing when the map
is missing. It installs a Three.js TSL color node that reads the `tileRegion`
and `tileRepeat` geometry attributes emitted by greedy meshing.

The shader samples mip level 0 because UV wrapping introduces derivative
discontinuities at each repeat. Calling code should not replace the material's
`onBeforeCompile` or remap its texture UVs after enabling wrapping.

Applications normally use this indirectly through `VoxelEngine({ greedy: true })`.
The export is available for compatible custom material setup.


# world-model.md

# World model

A `VoxelWorld` contains named `VoxelLayer` instances. Each layer divides its
voxel data into fixed-size `VoxelChunk` instances and stores placed objects in
separate object layers.

```text
VoxelWorld
  +-- VoxelLayer
  |     +-- VoxelChunk
  |           +-- VoxelStore
  +-- VoxelObjectLayerJSON
```

## Layer compositing

Voxel layers are composited from the highest `order` to the lowest. At one world
position, the first visible layer with `opacity > 0` and a stored voxel wins.
This lets a decorative layer replace base terrain without modifying it.

An opacity below `1` stops the layer from occluding neighbouring faces during
mesh generation. An opacity of `0` behaves like `visible = false`. Collision is
unchanged for partially transparent layers and removed only when the layer is
hidden.

## Coordinates and offsets

Chunk coordinates identify a chunk. Local coordinates identify a cell inside
that chunk. Public world and layer methods accept world-space positions.

A layer offset translates every voxel without changing its chunk storage. Use
`VoxelWorld.setLayerOffset()` or `translateLayer()` so the world marks affected
chunks dirty and recalculates cross-layer face culling.

## Ownership

`VoxelWorld` owns layer ordering and composited reads. `VoxelLayer` owns chunks
and direct reads or writes for one layer. `VoxelChunk` owns the fixed-size grid,
and `VoxelStore` owns its sparse packed values.

Use [`VoxelEngine`](../api/core/VoxelEngine.md) for application edits that must
also update rendering, collision, and hooks. The lower-level world classes are
useful for headless processing and integrations.


# adding-physics.md

# Adding physics

Pass a collider factory when constructing `VoxelEngine` or `VoxelRenderer`.
The bundled Rapier implementation accepts an initialized Rapier namespace and
world.

```ts
import Rapier from "@dimforge/rapier3d-compat";
import { VoxelRenderer } from "@jolly-pixel/voxel.renderer";
import {
  RapierVoxelCollider
} from "@jolly-pixel/voxel.renderer/plugins/rapier/index.js";

await Rapier.init();

const rapierWorld = new Rapier.World({
  x: 0,
  y: -9.81,
  z: 0
});

const renderer = actor.addComponentAndGet(VoxelRenderer, {
  collider: (context) => new RapierVoxelCollider({
    api: Rapier,
    world: rapierWorld,
    ...context
  })
});
```

The factory runs once after the block and shape registries have been created.
Chunk colliders are rebuilt with chunk meshes and removed when a chunk becomes
empty, its layer is hidden, or the engine is disposed.

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


# creating-custom-shapes.md

# Creating custom shapes

Implement `BlockShape`, register the instance, then reference its ID from a
`BlockDefinition`.

```ts
import {
  VoxelEngine,
  type BlockShape,
  type Face,
  type FaceDefinition
} from "@jolly-pixel/voxel.renderer";

class MyShape implements BlockShape {
  readonly id = "myShape";
  readonly collisionHint = "box" as const;
  readonly faces: readonly FaceDefinition[] = [
    // Define triangles or quads in normalized block space.
  ];

  occludes(_face: Face): boolean {
    return false;
  }
}

const engine = new VoxelEngine({
  shapes: [new MyShape()]
});
```

`faces` use coordinates from 0 through 1 within a voxel. Return `true` from
`occludes()` only when the shape completely covers the requested axis-aligned
face. An incorrect `true` result removes visible geometry from neighbouring
blocks.

Registering through `engine.shapeRegistry` is also supported:

```ts
engine.shapeRegistry.register(new MyShape());
```

Register the shape before placing blocks that use it. Then add a matching block
definition:

```ts
engine.blockRegistry.register({
  id: 10,
  name: "Custom",
  shapeId: "myShape",
  collidable: true,
  defaultTexture: {
    col: 0,
    row: 0
  }
});
```

The [`BlockShape` reference](../api/blocks/BlockShape.md) documents face culling
and collision hints. The [built-in shape catalog](../api/blocks/built-in-shapes.md)
provides examples of the supported shape IDs.


# importing-a-tiled-map.md

# Importing a Tiled map

Use `TiledConverter` when application code already loads the Tiled JSON.

```ts
import { loadJSON } from "@jolly-pixel/engine";
import {
  VoxelEngine,
  loadTilesets
} from "@jolly-pixel/voxel.renderer";
import {
  TiledConverter,
  type TiledMap
} from "@jolly-pixel/voxel.renderer/plugins/tiled/index.js";

const map = await loadJSON<TiledMap>("map.tmj");
const document = new TiledConverter().convert(map, {
  resolveTilesetSrc: (_source, id) => `assets/${id}.png`,
  layerMode: "stacked"
});

const tilesets = await loadTilesets(document.tilesets);
const engine = new VoxelEngine({ tilesets });

engine.load(document);
```

Use `"flat"` when Tiled layers should overlap at y = 0. Use `"stacked"` when
each layer represents another height or floor.

## Load through the asset system

`TiledMapAssetLoader` packages the converted document and textures as one asset.

```ts
import {
  AssetCatalog,
  AssetId,
  AssetRecord
} from "@jolly-pixel/asset";
import { Runtime } from "@jolly-pixel/runtime";
import {
  TiledMapAssetLoader,
  TiledMapAssetType
} from "@jolly-pixel/voxel.renderer/plugins/tiled/index.js";

const mapId = new AssetId("map.intro");
const catalog = new AssetCatalog([
  new AssetRecord({
    id: mapId,
    kind: TiledMapAssetType.kind,
    source: "maps/intro.tmj"
  })
]);

const canvas = document.querySelector("canvas");
if (!canvas) {
  throw new Error("HTMLCanvasElement not found");
}

const runtime = await Runtime.create(canvas, {
  assets: {
    catalog,
    loaders: [{
      type: TiledMapAssetType,
      create(manager) {
        return new TiledMapAssetLoader(manager, {
          layerMode: "stacked"
        });
      }
    }]
  }
});
```

Read the prepared asset during the component lifecycle:

```ts
const { world, tilesets } = this.getAsset(VoxelMap.assets.map);
const renderer = this.actor.addComponentAndGet(VoxelRenderer, {
  tilesets
});

renderer.engine.load(world);
```

See [`TiledConverter`](../api/tiled/TiledConverter.md) and
[`TiledMapAssetLoader`](../api/tiled/TiledMapAssetLoader.md) for option defaults
and output types.


# loading-and-restoring-tilesets.md

# Loading and restoring tilesets

Fetch tileset images before constructing the engine. This keeps asynchronous
work outside ECS lifecycle methods.

```ts
import {
  VoxelRenderer,
  loadTilesets
} from "@jolly-pixel/voxel.renderer";

const tilesets = await loadTilesets([
  {
    id: "default",
    src: "tileset.png",
    tileSize: 16
  }
]);

const renderer = actor.addComponentAndGet(VoxelRenderer, {
  tilesets
});
```

Tile references without a `tilesetId` use the first registered atlas.

## Restore a saved world

Load the atlases named by the document before calling `load()`:

```ts
const snapshot = JSON.parse(
  localStorage.getItem("world")!
) as VoxelWorldJSON;

const tilesets = await loadTilesets(snapshot.tilesets);
const engine = new VoxelEngine({
  chunkSize: snapshot.chunkSize,
  tilesets
});

engine.load(snapshot);
```

If the engine already exists, fetch only the missing definitions and pass them
with the load operation:

```ts
const missing = snapshot.tilesets.filter(
  (definition) => !engine.tilesetManager.has(definition.id)
);

engine.load(snapshot, {
  tilesets: await loadTilesets(missing)
});
```

`load()` throws when the document references an atlas that has not been
registered. See the [tileset reference](../api/tilesets/tilesets.md) for the
underlying loading and registration APIs.


# persisting-a-voxel-map.md

# Persisting a voxel map

The asset-server integration stores a voxel map as an event-sourced asset. Add
the handler when creating the asset backend:

```ts
import {
  voxelMapAssetHandler
} from "@jolly-pixel/voxel.renderer/asset/index.ts";

await createAssetBackend({
  source: new FilesystemAssetSource("./assets"),
  eventStore,
  handlers: [
    voxelMapAssetHandler({
      chunkSize: 16
    })
  ]
});
```

`@jolly-pixel/asset-server` and `@jolly-pixel/event-store` are optional peer
dependencies. Import this subpath only from server code.

The handler claims `**/*.voxelmap.json` by default. Documents use the same
`VoxelWorldJSON` shape as `VoxelEngine.save()`.

## Choose persistent or in-memory synchronization

`VoxelSyncServer` holds one world in process memory. It is suitable for an
ephemeral shared world. The asset handler rebuilds state from an event log and
writes snapshots to an asset source.

Both integrations use the same network command protocol, so `VoxelSyncClient`
can connect to either one. Asset rooms derive their room ID from the asset ID;
an in-memory server receives a fixed ID through its constructor.

## Snapshot cadence

The handler waits for a 5-second quiet period and writes at least once every
60 seconds while changes continue. Pass a `snapshot` policy to override those
defaults.

Terrain changes often arrive in bursts, and serializing a large world is more
expensive than serializing an ordinary asset record. The longer default reduces
snapshot churn during editing.

See [voxel-map asset APIs](../api/asset-server/voxel-map-assets.md) for handler
options, state ownership, and the room extension.


# saving-and-loading-worlds.md

# Saving and loading worlds

`VoxelEngine.save()` returns plain JSON containing layers, objects, tileset
definitions, and registered blocks.

```ts
const document = sourceEngine.save();

localStorage.setItem(
  "map",
  JSON.stringify(document)
);
```

Load the document's textures before restoring it:

```ts
const document = JSON.parse(
  localStorage.getItem("map")!
) as VoxelWorldJSON;

const engine = new VoxelEngine({
  chunkSize: document.chunkSize,
  tilesets: await loadTilesets(document.tilesets)
});

engine.load(document);
```

Every referenced tileset must be registered by the time `load()` applies the
document. Embedded block definitions are registered only when the same ID is
not already present, so local definitions win.

Use `parseVoxelDocument()` before treating an unknown JavaScript value as a
voxel document. Use `encodeVoxelDocument()` and `decodeVoxelDocument()` when a
storage or network boundary works with bytes.

The [serialization reference](../api/serialization/serialization.md) documents
the JSON schema, validation, and codec errors.


# synchronizing-a-world.md

# Synchronizing a world

`VoxelSyncClient` connects a `VoxelEngine` to a network room.
`VoxelSyncServer` owns the authoritative headless world for that room.

## Connect a client

```ts
import * as network from "@jolly-pixel/network";
import {
  VoxelSyncClient,
  type VoxelNetworkCommand,
  type VoxelServerMessage
} from "@jolly-pixel/voxel.renderer/network/index.ts";

const protocol = location.protocol === "https:" ? "wss:" : "ws:";
const client = new network.Client({
  url: `${protocol}//${location.host}/ws-sync`
});
const room = client.room<
  VoxelNetworkCommand,
  VoxelServerMessage
>("voxel-map:world");

const sync = new VoxelSyncClient({ room });
sync.attach(renderer.engine);
```

`attach()` preserves the engine's existing `onLayerUpdated` listener and chains
network sending after it. `detach()` restores that listener. Call `destroy()`
when the client is no longer needed; it detaches, removes the message listener,
and leaves the room.

## Register the server

Register one server extension per world through the network Vite plugin:

```ts
import { defineConfig } from "vite";
import {
  createWebSocketNetworkPlugin
} from "@jolly-pixel/network/plugins/vite.ts";
import {
  VoxelSyncServer
} from "@jolly-pixel/voxel.renderer/network/index.ts";

export default defineConfig({
  plugins: [
    createWebSocketNetworkPlugin({
      extensions: [
        new VoxelSyncServer({
          id: "voxel-map:world"
        })
      ]
    })
  ]
});
```

The server's initial layers must match the client bootstrap state. A layer
created before synchronization is not sent as a command. Seed the authoritative
world when the client expects an initial layer:

```ts
const world = new VoxelWorld(16);
world.addLayer("Ground");

const server = new VoxelSyncServer({
  id: "voxel-map:world",
  world
});
```

## Replace the world

```ts
sync.replaceWorld(renderer.engine.save());
```

The server replaces its voxel and object layers, then broadcasts a fresh
snapshot. Server snapshots omit block definitions and use an empty tileset
list, so every client must already have matching blocks and textures.

## Access control

Rights use the extension name `"voxel.renderer"` and hook action names such as
`"voxel-set"`. Configure them on `network.Server` beside the Vite plugin. The
network package allows actions that do not have a matching policy entry, so list
every mutation that a restricted role must not perform or use a trailing
`"voxel.renderer.*"` rule.

Client-supplied role values are not authentication. Resolve roles from a trusted
session before constructing the room identity when access control matters.

See [network synchronization](../concepts/network-synchronization.md) for the
message flow and conflict rules. API details are available for
[`VoxelSyncClient`](../api/network/VoxelSyncClient.md) and
[`VoxelSyncServer`](../api/network/VoxelSyncServer.md).
