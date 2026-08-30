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
  block: number;     // ResolvedBlockDefinition.id
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
  color?: string;
  locked?: boolean;
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
  blocks?: ResolvedBlockDefinition[];
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

## normalizeVoxelExtent

```ts
function normalizeVoxelExtent(value: number): number
```

Snaps a `VoxelObjectJSON` `width` or `height` to the whole voxels the engine
stores, clamping to one.

| Input | Result |
|---|---|
| `3` | `3` |
| `2.6` | `3` |
| `0.5` | `1` |
| `0`, negative, `NaN`, `Infinity` | `1` |

## voxelObjectFootprint

```ts
interface VoxelObjectFootprint {
  width: number;
  height: number;
}

function voxelObjectFootprint(object: VoxelObjectJSON): VoxelObjectFootprint
```

Whole-cell footprint an object occupies. An absent `width` or `height` means a
single cell; a stored extent is snapped through `normalizeVoxelExtent`. `width`
spans x, `height` spans z.
