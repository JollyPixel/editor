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
   * Initial state of the debug inspector (`engine.debug`). Mesh counters are
   * always collected; this only decides whether the wireframe is drawn from
   * the start. See [Debug](./Debug.md).
   */
  debug?: VoxelDebuggerOptions;

  /**
   * Texels of edge-replicated gutter added around every tile of an atlas before
   * it is bound to a material. Prevents distant geometry from sampling
   * neighbouring tiles. See [Tileset](./Tileset.md#atlas-padding).
   * Set to 0 to render atlases untouched.
   * @default half the tile size, clamped to 2..8
   */
  tilesetPadding?: number;

  /**
   * Merge coplanar identical block faces into the largest quads possible
   * instead of one quad per voxel face. Roughly 3x fewer triangles on terrain.
   * See [Greedy meshing](#greedy-meshing).
   * @default false
   */
  greedy?: boolean;

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
  readonly debug: VoxelDebugger; // mesh statistics + wireframe, see ./Debug.md

  greedy: boolean; // read/write; assigning rebuilds every chunk
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

## Chunk geometry layout

A chunk produces one `THREE.Mesh` per tileset it references, all parented to
`root`. Their geometries are indexed and carry four attributes:

| Attribute  | Type      | Items | Notes |
|------------|-----------|-------|-------|
| `position` | `float32` | 3     | world space, not chunk-local |
| `normal`   | `float32` | 3     | not axis-aligned for ramps and corners |
| `uv`       | `float32` | 2     | atlas coordinates, half-texel inset |
| `color`    | `uint8`   | 4     | normalized; RGB is white, alpha is the layer opacity |

Vertices are never shared between faces — each face needs its own UVs and
normal — so a cube costs 24 vertices, not 8.

Alpha is baked per vertex rather than set on the material so a future per-block
opacity (e.g. windows) only changes what the builder writes, not how materials
are keyed and shared. Being a normalized byte, it round-trips through
`getW()` within `1/255` of the layer's `opacity`.

## Greedy meshing

With `greedy: true` the builder stops emitting one quad per voxel face and
instead stretches each face over the largest rectangle of identical voxels it
can find. On the bundled noise-terrain benchmark (512², chunk size 32) that
takes 1,986,252 triangles down to 666,370 — a 3x cut — for roughly the same
build time. Measure your own world with `npm run bench -- --greedy`.

Two voxels share a quad when they resolve to the same `(blockId, transform)`
pair and show the same world-space direction, which makes them identical in
texture, normal, winding and tileset. Merging never crosses a chunk boundary, so
rebuilds stay local to the chunk that changed.

Only faces that are a **full unit quad flat on the block boundary** merge:
every face of a cube or slab, and a ramp's base and back wall. Slopes, stair
risers, poles and triangles keep the per-voxel path, so a chunk mixing shapes
still meshes correctly — you simply get less merging. Rotated voxels never merge
with unrotated ones, since the transform turns the tile sideways.

### What it changes

A merged quad has to repeat its tile rather than stretch it, which the shader
does rather than the geometry. Chunk materials are therefore compiled through
`enableTileWrapping()`, and chunk geometry carries two extra attributes:

| Attribute    | Type      | Items | Notes |
|--------------|-----------|-------|-------|
| `uv`         | `float32` | 2     | **tile** space, `0..spanU` / `0..spanV` — not atlas space |
| `tileRegion` | `float32` | 4     | the tile's atlas rect: `offsetU, offsetV, scaleU, scaleV` |
| `tileRepeat` | `float32` | 2     | how many times the tile repeats on each axis |

That costs 24 bytes per vertex on top of the usual 36, which the drop in vertex
count more than pays for. It also means a `materialCustomizer` that overrides
`onBeforeCompile` or remaps `map` UVs will fight the wrapping shader.

The wrapping is safe here because atlases are sampled with `NearestFilter` and
carry no mipmaps — the usual objection to folding UVs in the fragment shader is
the derivative discontinuity at tile borders, which only matters once mip levels
are picked from those derivatives. Cutout blocks that also cast shadows are the
one gap: three builds its own depth material, which would sample the atlas with
unwrapped UVs.

### When not to use it

Merging needs random access, so the chunk is scattered into a dense grid and
swept per direction, bounded by the occupied box. That is cheap at chunk sizes
16–64 (within noise of the naive builder on the benchmark) but grows with the
cube of the chunk size: at `chunkSize: 256` the same world meshes about 35%
slower. The scratch grid costs `chunkSize³ × 4` bytes too — 128 KB at 32, but
64 MB at 256. Large chunks plus greedy meshing is the combination to avoid.

Greedy meshing is also incompatible with per-vertex lighting or ambient
occlusion, neither of which this renderer has today — vertex colors carry only
the layer opacity, which is uniform per chunk build.

```ts
const engine = new VoxelEngine({ chunkSize: 32, greedy: true });

// Toggling at runtime rebuilds every chunk and swaps the materials.
engine.greedy = false;
```

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
