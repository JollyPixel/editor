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
