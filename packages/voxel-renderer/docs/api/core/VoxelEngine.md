# VoxelEngine

Composes a [`VoxelDocument`](./VoxelDocument.md) with the
[`VoxelView`](./VoxelView.md) drawn from it, and forwards the members of both.
Applications that want one object for a world own the engine directly and
attach `engine.root` to their Three.js scene.

Reach for the two halves instead when they need separate lifetimes: a document
synced over the network and handed to the editor that renders it, a headless
document on a server, or several views of one document. `new VoxelEngine({
document })` adopts an existing document and builds only the view.

Editing the world itself (layers, voxels, objects) goes through `engine.world`,
which owns those methods and emits the [commands](./commands.md).

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

engine.world.setVoxel("Ground", {
  position: { x: 0, y: 0, z: 0 },
  blockId: 1
});

engine.world.setVoxel("Ground", {
  position: { x: 1, y: 0, z: 0 },
  blockId: 1,
  rotation: VoxelRotation.CW90,
  flipX: false,
  flipZ: false
});

const entry = engine.world.getVoxelAt({
  x: 0, y: 0, z: 0
});

// Move an entire layer in world space
// e.g. snap a prefab layer to a new grid position
engine.world.setLayerPosition("Ground", {
  x: 8, y: 0, z: 0
});
```

## VoxelEngineOptions

`VoxelEngineOptions` is [`VoxelDocumentOptions`](./VoxelDocument.md) and
[`VoxelViewOptions`](./VoxelView.md) together, plus `document`. Passing
`document` makes the engine adopt that one and ignore every document option.

```ts
interface VoxelEngineOptions {
  /** Adopt this document instead of building a private one. */
  document?: VoxelDocument;
}
```

```ts
type MaterialCustomizerFn = (
  material: THREE.MeshLambertMaterial | THREE.MeshStandardMaterial,
  tilesetId: string,
  surface: BlockSurface
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
   * Chunk radius around `focus` kept meshed and drawn, as a radius in chunks or
   * a full ViewDistance description. Ignored while `focus` is null.
   * @default Infinity
   */
  viewDistance?: number | ViewDistanceOptions;
  /**
   * What happens to a chunk that leaves the view distance: "hide" keeps its
   * geometry ready to show again, "unload" frees it and remeshes on return.
   * @default "hide"
   */
  viewDistancePolicy?: "hide" | "unload";
  /**
   * Undo/redo of voxel edits; see VoxelHistory. Disabled by default.
   */
  history?: VoxelHistoryOptions;
  /**
   * Enables collision when provided, disabled by default so no physics backend
   * is required. Called once during construction with the registries.
   * See plugins/rapier for the bundled Rapier3D implementation.
   */
  collider?: VoxelColliderFactory;
  /**
   * Keeps the shader-only tileRegion and tileRepeat attributes in memory after
   * the first render uploads them. Raycasting and colliders never read them.
   * @default false
   */
  retainVertexData?: boolean;
  /**
   * Chunk meshes cast shadows. Chunks built later inherit the flag.
   * @default false
   */
  castShadow?: boolean;
  /**
   * Chunk meshes receive shadows. Chunks built later inherit the flag.
   * @default false
   */
  receiveShadow?: boolean;
  /**
   * Strength of the ambient occlusion baked into chunk vertices, clamped to
   * 0 (off) through 1. See the rendering and meshing concept page.
   * @default 0
   */
  ambientOcclusion?: number;
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
   * Default texture coverage cutoff for mask blocks without alphaCutoff.
   * Applied before layer fading; opaque and blend modes ignore it.
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
   * Subscribed to the `"command"` event before the constructor creates any
   * layer. See [commands](./commands.md).
   */
  onCommand?: VoxelCommandListener;

  /**
   * Initial state of the inspector (`engine.inspector`). Mesh counters are
   * always collected; this only decides whether the wireframe is drawn from
   * the start. See [`VoxelInspector`](./VoxelInspector.md).
   */
  inspector?: VoxelInspectorOptions;

  /**
   * Merge coplanar identical block faces into the largest quads possible
   * instead of one quad per voxel face.
   * See [rendering and meshing](../../concepts/rendering-and-meshing.md#greedy-meshing).
   * @default false
   */
  greedy?: boolean;

  /**
   * `"average"` fades distant faces to the average colour of their tile
   * instead of letting nearest sampling shimmer. Falls back to `"nearest"`
   * when the atlas pixels cannot be read.
   * See [rendering and meshing](../../concepts/rendering-and-meshing.md#distant-tiles).
   * @default "average"
   */
  tileMinification?: "average" | "nearest";

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

`apply()` accepts:

```ts
interface VoxelApplyOptions {
  /** @default "local" */
  origin?: "local" | "remote";
}
```

## Properties

Everything below `document` and `view` is a getter onto one of them.

```ts
class VoxelEngine extends Emitter<VoxelEngineEvents> {
  readonly document: VoxelDocument;
  readonly view: VoxelView;

  readonly root: THREE.Group; // container for all chunk meshes
  readonly world: VoxelWorld;
  readonly blockRegistry: BlockRegistry;
  readonly shapeRegistry: BlockShapeRegistry;
  readonly tilesetManager: TilesetManager;
  readonly inspector: VoxelInspector;
  readonly history: VoxelHistory; // see VoxelHistory.md

  greedy: boolean; // read/write; assigning rebuilds every chunk
  tileMinification: "average" | "nearest"; // read/write; assigning replaces the materials
  castShadow: boolean; // read/write; assigning updates built chunks
  receiveShadow: boolean; // read/write; assigning updates built chunks
  ambientOcclusion: number; // read/write; switching on or off rebuilds every chunk
  focus: THREE.Vector3Like | null;
  viewDistance: ViewDistance;
  viewDistancePolicy: "hide" | "unload";
  readonly pendingRebuilds: number;
  readonly tilesets: TilesetList;
  defaultTileSize: number | undefined;
}
```

## Lifecycle

```ts
init(): void;                   // builds meshes for any voxels already present (e.g. after deserialize)
tick(deltaTime: number): void;  // rebuilds dirty chunks within a time budget; call once per frame
flush(): void;                  // rebuilds every pending chunk now, ignoring the budget
whenIdle(): Promise<void>;       // resolves once no chunk in view is left to mesh
dispose(): void;                // disposes meshes, materials, tileset textures and listeners
```

Call these methods from the application's initialization, frame, and teardown
lifecycle.

### Rebuild budget

`tick()` spends at most `rebuildBudgetMs` (default `8` ms) per frame and defers the rest. Set to `0` to rebuild everything synchronously. `init()` and `load()` always rebuild the whole world synchronously regardless. Use `flush()` when meshes must be ready before the next line runs.

```ts
const engine = new VoxelEngine({ rebuildBudgetMs: 8 });

engine.focus = focusPoint;  // prioritize chunks near this point
engine.pendingRebuilds;     // 0 once the world is up to date
```

`pendingRebuilds` only counts queued chunks: a chunk edited since the last tick
is dirty but not queued yet. `whenIdle()` also waits for those. It resolves at
once when nothing inside the view distance is dirty or queued, otherwise at the
end of the first `tick()` or `flush()` that leaves nothing to mesh. Chunks
beyond the view distance do not hold it back. It never resolves after
`dispose()`.

```ts
engine.world.setVoxel("Ground", { position, blockId });
await engine.whenIdle();    // the new voxel is meshed
```

### Focus

`focus` is a point in `root` local space, reread on every tick, so a live
vector can be assigned once. Without it the queue is drained in the order
chunks were created, which for a world generated from its origin means the
chunks nearest the camera are built last. An application can sample an
`Object3D` world position into this property each frame.

The queue is reordered when it grows and when the focus has drifted by half a
chunk, so a moving camera keeps pulling the nearest chunks forward.

### View distance

With a finite `viewDistance`, chunks further than that radius from `focus` are
not meshed at all and stay dirty until they come into range, carrying every
edit they missed. Chunks already built when they leave the radius follow
`viewDistancePolicy`.

```ts
import { ViewDistance } from "@jolly-pixel/voxel.renderer";

const engine = new VoxelEngine({
  viewDistance: 8,             // radius in chunks
  viewDistancePolicy: "hide"   // or "unload"
});

engine.viewDistance = new ViewDistance({
  chunks: 12,
  shape: "sphere",
  hysteresis: 2
});
```

| Option | Meaning |
|---|---|
| `chunks` | Radius in chunks. `Infinity` (the default) disables the whole mechanism. |
| `shape` | `"xz"` (default) ignores the vertical axis, like Minecraft's cylinder; `"sphere"` measures all three axes. |
| `hysteresis` | Extra radius in chunks a visible chunk keeps before being dropped, so a chunk on the border does not flip every tick. Defaults to `1`. |

`"hide"` keeps the geometry uploaded and only toggles mesh visibility, which
costs memory but makes coming back free. `"unload"` disposes the geometry and
remeshes the chunk on return.

The view distance is visual only: colliders built for a chunk survive an
unload, so physics never depends on where the camera points. It also does
nothing while `focus` is `null`, and `flush()` does not force out-of-range
chunks to be meshed.

`ViewDistance` is immutable, so assign a new instance to change it; the engine
detects the swap and reapplies it on the next tick.

The [rendering and meshing](../../concepts/rendering-and-meshing.md) concept
explains the chunk geometry layout, rebuild queue, and greedy meshing tradeoffs.

## Methods

Layers, voxels and object layers live on [`engine.world`](../world/VoxelWorld.md).
The engine keeps only what concerns rendering, tilesets and persistence.

#### `tilesets: TilesetList`

The declared tilesets of the world, shared with `tilesetManager`. The first one is the
default for tile references with no explicit `tilesetId`. See
[TilesetList](../tilesets/tilesets.md#tilesetlist).

#### `defaultTileSize: number | undefined`

The document's preferred tile size for new tilesets. Assigning it applies a
`default-tile-size-updated` command.

#### `loadTileset(def: TilesetDefinition, texture: TilesetTexture): void`

Registers an already-loaded texture for a tileset, declaring it first when its ID is
unknown. Prefer passing `VoxelEngineOptions.tilesets` for pre-loading; use this method
for a texture that arrives after construction. Loading an ID that already has an atlas
replaces it, which is how a resized source image takes effect. Emits no command.

#### `addTileset(tileset)`, `removeTileset(tilesetId)`, `resizeTileset(tilesetId, tileSize)`

Shorthands for `apply()` with `tileset-added`, `tileset-removed` and
`tileset-resized`. Each returns whether the list changed.

Blocks using a removed tileset keep their voxels and are drawn with the
[missing-tileset texture](../tilesets/TilesetManager.md#missing-tileset), a
red tile with a white cross. A tileset that is declared but has no texture yet
is different: its blocks are not drawn and do not cull their neighbours until
`loadTileset()` provides the texture.

#### `save(): VoxelWorldJSON`

Serialises voxel layers, object layers, voxels, the declared tilesets, `defaultTileSize`
and registered block definitions to a plain JSON object.

#### `load(data: VoxelWorldJSON, options?: VoxelLoadOptions): void`

Clears the current world and restores state from a JSON snapshot. The snapshot's
tilesets and `defaultTileSize` replace the declared ones, atlases of tilesets it no
longer declares are disposed, then `VoxelLoadOptions.tilesets` are registered. A
declared tileset without atlas logs a warning and its faces stay hidden until
`loadTileset()` registers it. Tile references without `tilesetId` are assigned the
first declared tileset.

A snapshot carrying block definitions replaces the registry with them; one carrying
none leaves the registry alone.
Set `mergeLayers: true` to collapse voxel layers after deserialization.
`data.chunkSize` is metadata; `load()` keeps the engine's configured chunk size.
Construct the engine with the snapshot's chunk size when the values must match.

Deserialization is muted, so restoring a snapshot emits no command.

#### `markAllChunksDirty(source?: string): void`

Marks every chunk dirty for a later rebuild.

#### `defineBlock(def: BlockDefinition): void`

Registers a block definition, marks every chunk dirty, and emits a `block-defined` command.
An existing ID is overwritten. Tile references without `tilesetId` are assigned the
first declared tileset. This is the mutation path a synchronized editor
should use; writing straight to `blockRegistry` emits nothing.

#### `defineBlocks(defs: Iterable<BlockDefinition>): void`

Registers a batch, marking the chunks dirty once and emitting one event per
definition. An empty batch does nothing.

#### `blockAt(position: THREE.Vector3Like): ResolvedBlockDefinition | undefined`

Resolves the voxel at a world position to its block definition, reading the
highest-priority layer that holds one. Returns `undefined` for air and for a
voxel whose block is no longer registered. The definition is the stored one, not
a copy; do not mutate it.

#### `blockPropertiesAt(position: THREE.Vector3Like): BlockProperties | undefined`

Same lookup, returning a fresh copy of the block's
[custom properties](../blocks/BlockDefinition.md#custom-properties) that the
caller owns. Returns `undefined` for air and for an unregistered block, and an
empty object for a block carrying no properties.

#### `removeBlock(blockId: number): boolean`

Shorthand for `apply()` with `block-removed`: unregisters a definition and
marks every chunk dirty.
Returns `false` and emits nothing when the ID is unknown. `nextId` is unaffected,
so the ID is never recycled.

#### `moveBlock(blockId: number, toIndex: number): boolean`

Shorthand for `apply()` with `block-moved`: relocates a block within the
registry's order and emits the position it landed on, clamped into range. Returns `false` and emits
nothing for an unknown ID or a move that changes nothing. The order is a
document concern only, so no chunk is marked dirty. See
[`BlockRegistry` ordering](../blocks/BlockRegistry.md#ordering).

### Commands

#### `apply(command: VoxelCommand, options?: VoxelApplyOptions): boolean`

Applies any [command](./commands.md) with
[`applyVoxelCommand()`](./commands.md#applying-commands), then runs its side
effects and emits it once on `"command"` with `options.origin`. A
`block-defined` block is resolved and given the default tileset first. Block
definitions and removals mark every chunk dirty; tileset commands dispose the
atlas of a removed tileset, rebuild the atlas of a resized one and mark every
chunk dirty. Returns `false` and emits nothing when the command changes
nothing; layer commands always return `true`.

A network adapter applies peer commands with `{ origin: "remote" }` and sends
only the `"local"` ones, so nothing is echoed back.

#### `on("command", listener)` / `off("command", listener)`

`VoxelEngine` extends `Emitter` from `@openally/emitt`. The `"command"`
event receives every command applied through the engine, and every local layer
command forwarded from [`engine.world`](../world/VoxelWorld.md#commands). A
direct `blockRegistry` or `tilesets` mutation emits nothing, and `load()`
emits nothing.

The material customizer receives the resolved [BlockSurface](../blocks/BlockSurface.md)
for each draw group. It can distinguish masked and blended geometry without
inferring the policy from the material opacity, and reads
`surface.materialGroup` to tune grouped blocks apart on a shared atlas. To composite overlapping
blended chunks, install [VoxelTransparencyRenderer](./VoxelTransparencyRenderer.md)
in the application render loop.
