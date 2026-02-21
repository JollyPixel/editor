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
