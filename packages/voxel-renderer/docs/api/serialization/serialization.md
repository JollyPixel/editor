# Serialization

The serialization API defines the persisted world shape, converts live worlds,
and validates voxel worlds received as objects or UTF-8 JSON bytes. Most
applications use [`VoxelDocument.save()`](../core/VoxelDocument.md#methods) and
[`VoxelView.load()`](../core/VoxelView.md#methods), which also update materials
and chunk meshes.

## World document

```ts
type VoxelEntryKey = `${number},${number},${number}`;

interface VoxelEntryJSON {
  block: number;
  transform: number;
}

interface VoxelLayerJSON {
  compositing?: "replace" | "composite";
  id: string;
  name: string;
  visible: boolean;
  opacity?: number;
  order: number;
  position?: VoxelCoord;
  properties?: Record<string, any>;
  voxels: Record<VoxelEntryKey, VoxelEntryJSON>;
}

const VOXEL_WORLD_VERSION = 2;

interface VoxelWorldJSON {
  version: 2;
  chunkSize: number;
  tilesets: TilesetDefinition[];
  layers: VoxelLayerJSON[];
  objectLayers?: VoxelObjectLayerJSON[];
}
```

A world stores its layers and the tilesets it links. Blocks, material groups
and tile sizes belong to the tilesets: a
[`TilesetDocument`](../tilesets/TilesetDocument.md) carries them, and a host
projects them into the world's block registry through the tileset's slot.
Voxels store the projected ids, so a world file is only meaningful with the
tilesets it links.

Voxel keys contain layer-local coordinates. The layer position locates that
coordinate space in the world, so changing only `position` moves the layer.
Documents without `opacity` or `position` load with opacity `1` and a zero position.
A missing `compositing` loads as `"composite"`; use `"replace"` explicitly for
cell replacement.

`objectLayers` stores placed objects such as spawn points and trigger zones.

## Serializing a world

```ts
interface VoxelSerializeOptions {
  tilesets?: Iterable<TilesetDefinition>;
}

function serializeVoxelWorld(
  world: VoxelWorld,
  options?: VoxelSerializeOptions
): VoxelWorldJSON;

function serializeVoxelLayer(
  layer: VoxelLayer
): VoxelLayerJSON;

function serializeTilesetDefinition(
  definition: TilesetDefinition
): TilesetDefinition;
```

`serializeVoxelLayer()` writes one layer, voxels keyed by layer-local
coordinates; `serializeVoxelWorld()` calls it for each layer.

The world does not own the tileset list, so callers pass it explicitly. Each
definition is written through `serializeTilesetDefinition()`: an `asset`
tileset keeps only its `id`, `slot` and `asset`, since the asset owns the
tile size and grid; a `src` tileset keeps its `tileSize`, `cols` and `rows`.

## Deserializing a world

```ts
interface VoxelDeserializeOptions {
  tilesets?: TilesetList;
}

function deserializeVoxelWorld(
  data: VoxelWorldJSON,
  world: VoxelWorld,
  options?: VoxelDeserializeOptions
): void;
```

The function validates `data`, then replaces the world's voxel and object
layers. It throws `InvalidVoxelWorldError` when the document is malformed,
and leaves the target unchanged. Voxel keys are layer coordinates, so a document
saved with another `chunkSize` loads into the world's own chunks; serializing
the world again writes the world's `chunkSize`.

Layers are restored with [`world.restoreLayer()`](../world/VoxelWorld.md) and
object layers with `world.objectLayers.restore()`, so deserializing emits no
command, even outside `world.silently()`.

`options.tilesets` is replaced with the document's tilesets, slots included.
The block registry is never touched: register the projected blocks of the
linked tilesets before or after the load.

See [saving and loading worlds](../../guides/saving-and-loading-worlds.md) for
the application workflow.

## World codec

The world codec validates unknown input and converts voxel worlds to or
from UTF-8 JSON bytes.

```ts
function parseVoxelWorld(value: unknown): VoxelWorldJSON;

function encodeVoxelWorld(
  document: VoxelWorldJSON
): Uint8Array;

function decodeVoxelWorld(
  data: Uint8Array
): VoxelWorldJSON;

class InvalidVoxelWorldError extends Error {
  constructor(
    reason: string,
    options?: { cause?: unknown }
  );
}
```

`parseVoxelWorld()` requires version `VOXEL_WORLD_VERSION`, a positive
integer `chunkSize`, and a `layers` array. Earlier versions are rejected; there
is no migration. A missing or malformed `tilesets` value becomes an empty
array. A malformed `objectLayers` value is omitted. Unknown top-level keys,
including the `blocks`, `materialGroups` and `defaultTileSize` of earlier
versions, are discarded.

The parser validates the top-level document shape. Collection elements are
checked later while the world is deserialized; malformed layer or voxel entries
are skipped there.

`encodeVoxelWorld()` returns UTF-8 JSON bytes. `decodeVoxelWorld()` parses
those bytes and then applies `parseVoxelWorld()`. All three functions throw
`InvalidVoxelWorldError`, whose message starts with `Invalid voxel world: `;
decoding errors are available through its `cause`.

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

### `VoxelFootprint`

Immutable whole-cell area an object covers on the ground plane. Width spans x
and height spans z.

```ts
class VoxelFootprint {
  static readonly Unit: VoxelFootprint;
  static normalizeExtent(value: number): number;
  static of(
    object: Pick<VoxelObjectJSON, "width" | "height">
  ): VoxelFootprint;

  readonly width: number;
  readonly height: number;

  constructor(width: number, height: number);

  equals(other: VoxelFootprint): boolean;
  toJSON(): VoxelFootprintJSON;
}

interface VoxelFootprintJSON {
  width: number;
  height: number;
}
```

The constructor normalizes both extents, so a footprint is always whole cells.
`normalizeExtent()` rounds to the nearest whole voxel and clamps to at least
`1`; invalid, zero, and negative values become `1`.

`of()` reads an object's stored dimensions, where a missing one occupies a
single cell. It does not mutate the object.

`toJSON()` returns the `width` and `height` an object stores, so it can be
spread into a `VoxelObjectJSON` or an update patch.

```ts
const footprint = VoxelFootprint.of(object);

footprint.equals(new VoxelFootprint(size.x, size.z));
```
