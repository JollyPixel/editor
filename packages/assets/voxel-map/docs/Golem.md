# Golem

`@jolly-pixel/asset.voxel-map/golem` lets a golem open `voxelmap` and `blockset` assets. Its `GOLEM_KINDS` export is what `@jolly-pixel/golem` imports for these kinds when the studio lists this package; `golem.open(assetId, "voxelmap")` then returns the class below. Importing the entry adds the kinds to the `GolemAssets` interface of `@jolly-pixel/golem.kit`, which types that call.

An agent reaches the same edits through the MCP server: `asset_open` answers the guide in `src/golem/guide.md` and the intents below with their input schema, and `asset_intent` runs one.

## Intents

A voxel map has `summary`, `query`, `heightmap`, `addLayer`, `fillBox` and `clearBox`: each runs the method of the same name with its input and answers what the method returns.

A blockset has the pixel intents of `@jolly-pixel/asset.pixel-art/golem` for its texture: `readPixels`, `paintPixels`, `fillRect` and `replacePalette`.

## `VoxelMapAsset`

The asset for `voxelmap`. Commands are the map's world commands (`VoxelWorldCommand`: layers, voxels, objects, templates, blocksets). Positions are whole cells and y is up. A box is `{ min, max }` with both corners included.

```ts
const map = await golem.open(assetId, "voxelmap");
await map.fillBox({ layer: "Ground", min: { x: 0, y: 0, z: 0 }, max: { x: 15, y: 0, z: 15 }, block: "grass" });
await map.settled();
```

Opening a map also opens the blockset assets it links, so its blocks have names. `summary()` and every write open the blocksets the map gained since, and open again a blockset whose asset was closed. Closing the map closes those blocksets, except the ones the caller opened itself.

### `summary(): Promise<MapSummary>`

The chunk size, the voxel count, the layers (`id`, `name`, `visible`, `voxelCount`, and `bounds`, `null` for an empty layer), the blocksets (`id`, `slot`, `assetId`, `linked`, and `error` when its asset could not be opened) and the blocks (`id`, `name`, `shapeId`, `blockset`). `read()` returns the same summary at once, without opening blocksets.

### `query({ min, max, layer? }): MapQuery`

The occupied cells of the box as `{ x, y, z, block, layer }`. With `layer` it reads that layer only; without, the cell each position shows across layers. Stops at `MAX_QUERY_CELLS` (4,096) and sets `truncated`.

### `heightmap({ min, max, layer? }): MapHeightmap`

For each column of the box, on `layer` or across all layers, the highest occupied y within it, or `null`. `heights` holds one row per z from `min.z`, one value per x from `min.x`.

### `addLayer({ name, above? }): Promise<AddedLayer>`

Adds an empty layer on top, or right above the layer `above` names, and returns its `{ id, name }`. When another layer has `name`, the studio appends a number: `"Ground (1)"`.

### `fillBox({ layer, min, max, block }): Promise<number>`

Puts `block` in every cell of the box on `layer`, a layer name or id, and returns the number of cells written. Writes go out as `voxels-patched` commands of at most `MAX_PATCH_CELLS` (32,768) cells.

### `clearBox({ layer, min, max }): Promise<number>`

Empties the occupied cells of the box on `layer` and returns how many it emptied.

### `writeVoxels(voxels, options): Promise<number>`

Writes `{ position, block }` entries on `options.layer`; a `null` block empties the cell.

### Blocks, boxes and errors

- A block is a name, `"<blockset>/<name>"` when two blocksets share the name, or a block id. A name matching no block, or several, throws `UnknownBlockError`; `error.candidates` lists the qualified matches.
- A layer that does not exist throws `UnknownEntryError`. The `summary` intent and `summary()` list the layers.
- A box with a corner that is not a whole cell, `min` above `max`, or more than `MAX_BOX_CELLS` (1,000,000) cells throws `RangeError`.

### Focus

After each batch that writes voxels, the golem's brush presence (`brush`) moves to the last written cell, so the voxel-map editor shows it like a person's brush.

## `BlocksetAsset`

The asset for `blockset`. Commands are its block, material group and blend group commands (`block-defined`, `material-group-defined`, `tile-size-updated`, …) and the pixel-art commands of its texture; one batch can mix both.

### `pixels: PixelSurface`

The blockset's texture, painted and read like a pixel-art texture's (`PixelSurface` from `@jolly-pixel/asset.pixel-art/golem`).

### `blocks(): BlockSummary[]`

The blocks as `{ id, name, shapeId, tiles }`, ids local to the blockset. `tiles` maps each face slot of `faceTextures`, and `default` for `defaultTexture`, to the `{ x, y, width, height }` it draws from on the texture.

### `read(): BlocksetDocumentJSON`

The tile size, blocks, material groups and blend groups.

### `link(map, slot): BlocksetLink`

Projects the blocks into `map`, a voxel document, under `slot`, and keeps them in step with the blockset. Dispose the link to stop. `VoxelMapAsset` links its blocksets this way.

## How it works

- `SyncedVoxelMap.applyStep` runs the document's `applyCommand` and returns the change `VoxelEdits.captureLocal` saw. The map's `loaded()` hook, which `ready` waits for, has `MapBlocksets` open the linked blockset assets through `studio.open` and link them with `BlocksetAsset.link`. Writes and `summary()` link again first, so a blockset added, closed, or pointed at another asset or slot since is picked up.
- A blockset uses the editor's `SyncedBlockset`, whose texture is a `PixelDocument` too. `PixelSurface` paints and reads both kinds' textures through the asset's `applyInBatches`.
