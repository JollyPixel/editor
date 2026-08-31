# VoxelEngine

Builds and maintains the chunked Three.js meshes of a [`VoxelWorld`](../world/VoxelWorld.md),
along with its blocks, tilesets and materials. Use it directly, or through
[`VoxelRenderer`](./VoxelRenderer.md), which exposes it as `vr.engine`.

Editing the world itself (layers, voxels, objects) goes through `engine.world`,
which owns those methods and emits the [hook events](./hooks.md).

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
engine.world.setLayerOffset("Ground", {
  x: 8, y: 0, z: 0
});
```

When wrapped by [`VoxelRenderer`](./VoxelRenderer.md), reach the same API via
`vr.engine.world.<method>(...)`.

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
  focus: THREE.Vector3Like | null;
  viewDistance: ViewDistance;
  viewDistancePolicy: "hide" | "unload";
  readonly pendingRebuilds: number;
  onLayerUpdated: VoxelLayerHookListener | undefined; // proxies world.onLayerUpdated
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

engine.focus = focusPoint;  // prioritize chunks near this point
engine.pendingRebuilds;     // 0 once the world is up to date
```

### Focus

`focus` is a point in `root` local space, reread on every tick, so a live
vector can be assigned once. Without it the queue is drained in the order
chunks were created, which for a world generated from its origin means the
chunks nearest the camera are built last. [`VoxelRenderer`](./VoxelRenderer.md)
samples it from an `Object3D` for you.

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

Deserialization is muted, so restoring a snapshot emits no hook event.

#### `markAllChunksDirty(source?: string): void`

Marks every chunk dirty for a later rebuild.

### Hooks

`onLayerUpdated` and `applyRemoteCommand` proxy
[`VoxelWorld`](../world/VoxelWorld.md#hooks), which is where the events are
emitted from and where a headless peer applies them.

#### `applyRemoteCommand(command: VoxelLayerHookEvent): void`

Applies a hook event without emitting it again through `onLayerUpdated`. Network
adapters use this method to avoid echo loops.

See [hooks](./hooks.md) for the event reference.
