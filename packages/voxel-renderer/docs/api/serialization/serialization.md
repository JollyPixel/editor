# Serialization

The serialization API defines the persisted world shape, converts live worlds,
and validates voxel worlds received as objects or UTF-8 JSON bytes. Most
applications use [`VoxelDocument.save()`](../core/VoxelDocument.md#methods) and
[`VoxelView.load()`](../core/VoxelView.md#methods), which also update materials
and chunk meshes.

## World document

```ts
interface VoxelEntryJSON {
  block: number;
  transform: number;
}

interface VoxelChunkJSON {
  at: [number, number, number];
  cells?: number[];
  runs: number[];
}

interface VoxelLayerMetadataJSON {
  compositing?: "replace" | "composite";
  id: string;
  name: string;
  visible: boolean;
  rank: string;
  position?: VoxelCoord;
  properties?: Record<string, any>;
}

interface VoxelLayerJSON extends VoxelLayerMetadataJSON {
  palette: VoxelEntryJSON[];
  chunks: VoxelChunkJSON[];
}

const VOXEL_WORLD_VERSION = 4;

interface VoxelWorldJSON {
  version: 4;
  chunkSize: number;
  tilesets: TilesetDefinition[];
  layers: VoxelLayerJSON[];
  objectLayers?: VoxelObjectLayerJSON[];
  templates?: VoxelTemplateJSON[];
}
```

A world stores its layers and the tilesets it links. Blocks, material groups
and tile sizes belong to the tilesets: a
[`TilesetDocument`](../tilesets/TilesetDocument.md) carries them, and a host
projects them into the world's block registry through the tileset's slot.
Voxels store the projected ids, so a world file is only meaningful with the
tilesets it links.

Each layer lists its distinct voxels once in `palette`, most frequent first.
Chunks then store palette values: `v >= 1` means `palette[v - 1]` and `0`
means air.

- `at` is the chunk coordinate in units of `chunkSize`, in layer-local
  space. The layer position locates that space in the world, so changing only
  `position` moves the layer.
- A cell index is `x + y * S + z * S * S` for local coordinates in a chunk of
  size `S`.
- A dense chunk has only `runs`: `[length, value]` pairs covering all
  `S³` cells in index order, air included.
- A sparse chunk adds `cells`, the occupied cell indices in ascending order,
  written as gaps: the first index is `cells[0]`, and each next one is
  `previous + cells[k] + 1`. Its `runs` assign values of `1` or more to
  those cells.

The writer picks whichever encoding needs fewer numbers for each chunk.

```json
{
  "id": "layer_1", "name": "Terrain", "visible": true, "rank": "V",
  "palette": [{ "block": 65537, "transform": 0 }, { "block": 65538, "transform": 0 }],
  "chunks": [
    { "at": [0, 0, 0], "runs": [256, 2, 3840, 0] },
    { "at": [1, 0, 0], "cells": [17, 0, 0, 14], "runs": [3, 1, 1, 2] }
  ]
}
```

Documents without `position` load with a zero position, and a layer `opacity`
from older documents is ignored.
A missing `compositing` loads as `"composite"`; use `"replace"` explicitly for
cell replacement.

`objectLayers` stores placed objects such as spawn points and trigger zones.

### Templates

`templates` stores the world's [voxel templates](../world/VoxelTemplates.md).
The field is optional, so documents without it load with no template.

```ts
interface VoxelTemplateJSON {
  id: string;
  name: string;
  pivot: VoxelCoord;
  properties?: Record<string, any>;
  chunkSize: number;
  palette: VoxelEntryJSON[];
  chunks: VoxelChunkJSON[];
}
```

A template uses the layer encoding, in template-local space, with its own
`chunkSize`. The world writer uses the world's `chunkSize`; a template read
with another size is decoded with it. `pivot` is template-local.

```ts
function serializeVoxelTemplate(
  template: VoxelTemplate,
  chunkSize?: number // default: 16
): VoxelTemplateJSON;

function deserializeVoxelTemplate(
  data: VoxelTemplateJSON
): VoxelTemplate;

function parseVoxelTemplate(value: unknown): VoxelTemplateJSON;
```

`deserializeVoxelTemplate()` validates `data` with `parseVoxelTemplate()`
and throws `InvalidVoxelWorldError` when it is malformed. The
`"template-defined"` command carries the output of
`serializeVoxelTemplate()`.

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

`serializeVoxelLayer()` writes one layer with its palette and chunks;
`serializeVoxelWorld()` calls it for each layer. The output does not depend on
the order voxels were placed in.

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
and leaves the target unchanged. A document saved with another `chunkSize`
loads into the world's own chunks; serializing the world again writes the
world's `chunkSize`. A chunk that falls outside the world's chunk range once
re-partitioned is rejected before anything changes.

Layers are restored with [`world.restoreLayer()`](../world/VoxelWorld.md),
object layers with `world.objectLayers.restore()` and templates with
`world.templates.restore()`, so deserializing emits no command, even outside
`world.silently()`.

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

`parseVoxelWorld()` validates the whole document and throws on the first
problem, naming the layer and chunk:

- `version` is `VOXEL_WORLD_VERSION`. Earlier versions are rejected; there
  is no migration.
- `chunkSize` is a power of two.
- Each layer has a string `id` and `name`, a boolean `visible` and a
  `rank` (see [layer ranks](../world/VoxelWorld.md#layer-ranks)); `compositing`,
  `position` and `properties` are typed when present. The stack follows the
  ranks, not the array order.
- Each palette entry has a block id in `1..MAX_BLOCK_ID` and a transform in
  `0..255`.
- Each `at` is an integer triple within the layer chunk range (±1024 on X
  and Z, ±512 on Y), and appears once per layer.
- Run lengths are at least `1` and values at most `palette.length`. Dense
  runs cover exactly `S³` cells. Sparse runs assign values of `1` or more
  to every cell, and the last cell is below `S³`.
- `templates`, when present, is an array. Each template has a string `id`
  and `name`, a `pivot` coordinate, a power-of-two `chunkSize` and an
  object `properties` when present; its palette and chunks follow the layer
  rules with its own `chunkSize`.

A missing or malformed `tilesets` value becomes an empty array. A malformed
`objectLayers` value is omitted. Unknown top-level keys, including the
`blocks`, `materialGroups` and `defaultTileSize` of earlier versions, are
discarded. Unknown layer and chunk keys are ignored.

`encodeVoxelWorld()` returns UTF-8 JSON bytes. `decodeVoxelWorld()` accepts
bytes starting with `{`, after an optional byte order mark and whitespace,
parses them and then applies `parseVoxelWorld()`. All three functions throw
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
