# VoxelRenderer

`ActorComponent` that renders a layered voxel world as chunked Three.js meshes.
Each chunk is rebuilt only when its content changes, keeping GPU work proportional to edits rather than world size.

---

## VoxelRendererOptions

```ts
interface VoxelRendererOptions {
  /** Side length of each chunk in voxels. Default: `16`. */
  chunkSize?: number;
  /** Chunk material preset. `"standard"` enables PBR at higher GPU cost. Default: `"lambert"`. */
  material?: "lambert" | "standard";
  /**
   * Fragments with alpha below this value are discarded.
   * Set `0` to disable cutout transparency. Default: `0.1`.
   */
  alphaTest?: number;
  /** Layer names to create at initialisation. */
  layers?: string[];
  /** Block definitions to pre-register. */
  blocks?: BlockDefinition[];
  /** Custom shapes added on top of the built-in registry. */
  shapes?: BlockShape[];
  /** Enables Rapier3D collision. Omit to disable physics entirely. */
  rapier?: {
    api: RapierAPI;
    world: RapierWorld;
  };
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
