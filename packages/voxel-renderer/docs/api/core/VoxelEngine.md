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
