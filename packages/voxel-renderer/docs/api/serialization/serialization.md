# Serialization

The saved form of a world and the functions that read and write it. Most
applications only call [`document.save()`](../core/VoxelDocument.md#save-and-load)
and [`view.load()`](../core/VoxelView.md#methods); see
[saving and loading worlds](../../guides/saving-and-loading-worlds.md).

## VoxelWorldJSON

```ts
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

A world stores its layers, objects, templates and the tilesets it links.
Blocks and groups are not saved (see
[`VoxelDocument`](../core/VoxelDocument.md#properties)): voxels store block
ids, so a world file only makes sense alongside the tilesets it links.

Each `VoxelLayerJSON` holds the layer's `id`, `name`, `visible`, `rank` and
optional `position`, `compositing` and `properties`, plus its voxel data. A
missing `position` loads as `{ x: 0, y: 0, z: 0 }` and a missing `compositing`
as `"composite"`. Object layers are described on
[`VoxelWorld`](../world/VoxelWorld.md#voxel-objects).

## World functions

```ts
function serializeVoxelWorld(
  world: VoxelWorld,
  options?: { tilesets?: Iterable<TilesetDefinition> }
): VoxelWorldJSON;

function deserializeVoxelWorld(
  data: VoxelWorldJSON,
  world: VoxelWorld,
  options?: { tilesets?: TilesetList }
): void;

function serializeVoxelLayer(layer: VoxelLayer): VoxelLayerJSON;
function serializeTilesetDefinition(definition: TilesetDefinition): TilesetDefinition;
```

`serializeVoxelWorld()` writes the world with the given tileset list. Each
tileset goes through `serializeTilesetDefinition()`: an `asset` tileset keeps
only `id`, `slot` and `asset`, a `src` tileset keeps `tileSize`, `cols` and
`rows`. `serializeVoxelLayer()` writes a single layer.

`deserializeVoxelWorld()` validates `data` and replaces the world's layers,
objects and templates. It emits no command. On invalid data it throws
`InvalidVoxelWorldError` and leaves the world unchanged.

- The world keeps its own `chunkSize`; data saved with another size is
  re-chunked.
- `options.tilesets` is replaced with the saved tilesets, slots included.
- The block registry is not touched.

## Templates

```ts
function serializeVoxelTemplate(template: VoxelTemplate, chunkSize?: number): VoxelTemplateJSON;
function deserializeVoxelTemplate(data: VoxelTemplateJSON): VoxelTemplate;
function parseVoxelTemplate(value: unknown): VoxelTemplateJSON;
```

A `VoxelTemplateJSON` holds a [template](../world/VoxelTemplates.md)'s `id`,
`name`, `pivot`, optional `properties` and its voxels. `chunkSize` defaults to
`16`. `deserializeVoxelTemplate()` validates with `parseVoxelTemplate()` and
throws `InvalidVoxelWorldError` on malformed data. The `"template-defined"`
[command](../core/commands.md#template-commands) carries this form.

## Codec

```ts
function parseVoxelWorld(value: unknown): VoxelWorldJSON;
function encodeVoxelWorld(document: VoxelWorldJSON): Uint8Array;
function decodeVoxelWorld(data: Uint8Array): VoxelWorldJSON;

class InvalidVoxelWorldError extends Error {}
```

`parseVoxelWorld()` validates an unknown value. `encodeVoxelWorld()` returns
UTF-8 JSON bytes, and `decodeVoxelWorld()` parses such bytes (a leading byte
order mark is accepted) and validates the result.

All three throw `InvalidVoxelWorldError` on the first problem, with a message
starting `Invalid voxel world: ` and naming the layer and chunk. A JSON syntax
error is available as its `cause`.

- `version` must equal `VOXEL_WORLD_VERSION`; older versions are rejected.
- `chunkSize` must be a power of two.
- Chunk coordinates are limited to ±1024 on X and Z and ±512 on Y.
- A missing or malformed `tilesets` becomes `[]`; a malformed `objectLayers`
  is dropped; unknown keys are ignored.
