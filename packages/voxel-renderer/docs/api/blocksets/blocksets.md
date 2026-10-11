# Blocksets

A blockset is a set of blocks with the atlas image their faces sample, cut into
square tiles.

- `document.blocksets`, a [`BlocksetList`](#blocksetlist), holds the blockset
  definitions a world links.
- [`loadBlocksets()`](#loading-textures) fetches their images.
- [`BlocksetAtlases`](./BlocksetAtlases.md) and
  [`BlocksetAtlas`](./BlocksetAtlas.md) hold the loaded textures of a view.
- A [`BlocksetDocument`](./BlocksetDocument.md) holds the blocks, material
  groups and tile size that belong to one blockset; a
  [`BlocksetLink`](./BlocksetLink.md) projects it into a world.

```ts
const blocksets = await loadBlocksets([
  { id: "terrain", src: "terrain.png", tileSize: 16 }
]);
const view = new VoxelView(document, { blocksets });
```

## Definitions

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Required, unique. |
| `src` | `string` | Image URL, fetched by `loadBlocksets()`. |
| `asset` | `{ id: string; kind: string }` | A catalog asset the host loads itself instead of `src`. |
| `slot` | `number` | Block id namespace the blockset owns in the world, `0` to `MAX_BLOCKSET_SLOT` (127). Defaults to the lowest free slot. |
| `tileSize` | `number` | Tile side in pixels. Required with `src`; an `asset` blockset may declare it later through `VoxelView.loadBlockset()`. |
| `cols`, `rows` | `number` | Derived from the image when missing. |

A tile size is an integer from 1 to `MAX_TILE_SIZE` (4096); `isTileSize()`
checks one. `DEFAULT_TILE_SIZE` (32) is the tile size of a `BlocksetDocument`
created without one.

## Tile references

Blocks name their textures with tile references.

```ts
type TileRef = [col: number, row: number] | ResolvedTileRef;

interface ResolvedTileRef {
  col: number;
  row: number;
  blocksetId?: string;
  rotation?: 0 | 1 | 2 | 3;
  size?: number;
}
```

| Field | Default | Description |
| --- | --- | --- |
| `col`, `row` | | Top-left tile of the region. |
| `blocksetId` | first declared blockset | Filled in when a block is defined. |
| `rotation` | `0` | Clockwise quarter turns of the tile image on the face. Applies before the voxel's own rotation. |
| `size` | blockset `tileSize` | Side of the square region in texels. |

`resolveTileRef(ref, defaultBlocksetId?)` expands a tuple and fills the default
blockset id without mutating its input.

## BlocksetList

The ordered blockset definitions a world links, loaded or not. Definitions are
copied in and out, always with a `slot`. Changing the list directly emits no
command; use `document.addBlockset()` and `document.removeBlockset()` to share
changes with peers.

| Member | Description |
| --- | --- |
| `size` | Number of blocksets. |
| `version` | Increases on every change. |
| `defaultBlocksetId` | The first id, or `null`. |
| `definitions()` | Copies of every definition. |
| `ids()`, `has(id)`, `get(id)` | Lookups. |
| `findBySlot(slot)` | The blockset owning a slot. |
| `findAvailableSlot(reserved?)` | The lowest slot neither used nor in `reserved`, or `null` when all 128 are taken. |
| `add(definition)` | Adds a blockset. Refuses an empty or known id, a taken or invalid slot, an invalid tile size, and a `src` blockset without tile size. |
| `declare(definition)` | Adds an unknown blockset, or replaces a known one and keeps its slot. |
| `remove(id)`, `replace(definitions)`, `clear()` | `replace()` skips what `add()` refuses and keeps the first of duplicated ids. |

Each mutator returns whether the list changed.

## BlocksetSlot

`BlocksetSlot` converts between a blockset's local ids and the ids used in a
linked world. These operations return values without changing their inputs.

| Method | Result |
| --- | --- |
| `ownsBlockId(id)` | Whether a packed block id belongs to this slot. |
| `composeBlockId(localId)`, `decodeLocalBlockId(id)` | Convert numeric block ids between local and world namespaces. |
| `qualifyGroupId(localId)`, `decodeLocalGroupId(id)` | Add or remove the blockset prefix; decoding a different prefix returns `null`. |
| `projectBlock(block)`, `projectBlocks(blocks)` | Copies with world ids, qualified group ids, and textures assigned to this blockset. |
| `localizeBlock(block)` | A copy with local ids and texture blockset references removed. |
| `projectMaterialGroup(group)`, `localizeMaterialGroup(group)` | Copies with world or local material group ids. |
| `projectBlendGroup(group)` | A copy with its id and excluded group ids qualified. |

## Loading textures

```ts
function loadBlocksets(
  definitions: Iterable<BlocksetDefinition>,
  options?: { manager?: THREE.LoadingManager; loader?: TextureSourceLoader }
): Promise<AtlasSource[]>;

interface TextureSourceLoader {
  loadAsync(url: string): Promise<AtlasTexture>;
}

type AtlasTexture =
  | THREE.Texture<HTMLImageElement | HTMLCanvasElement>
  | THREE.CompressedTexture;

interface AtlasSource {
  def: BlocksetDefinition;
  texture: AtlasTexture;
  normal?: AtlasNormalTexture;
}
```

Fetches the `src` images in parallel and resolves with one source per id;
definitions without `src` are skipped. `loader` replaces the default
`THREE.TextureLoader`, which is the only thing `manager` is passed to. Pass the
result to `VoxelViewOptions.blocksets` or `view.load()`. `normal` is never
filled; add a [normal atlas](../../concepts/rendering-and-meshing.md#normal-maps)
yourself.

To load `.ktx2` atlases, pass a `KTX2Loader` from
`three/addons/loaders/KTX2Loader.js` as `loader`, after setting its transcoder
path and calling `detectSupport(renderer)`. A compressed atlas has no readable
pixels, so its faces use nearest sampling under
[tile minification](../../concepts/rendering-and-meshing.md#tile-minification).

## Tile geometry

Helpers for editors that draw or pick tile regions. Texel rectangles have their
origin at the top-left of the image. `TileBounds` (`u0, v0, u1, v1`) is a
normalized rectangle inside a tile with `v` up; `TileSpan` (`u, v`) is a face
slot's size in tiles, such as `{ u: 1, v: √2 }` on a ramp slope.

| Function | Returns |
| --- | --- |
| `resolveTileRect(ref, tileSize, bounds?, span?)` | The `TileRect` (`x, y, width, height`) in texels that `bounds` covers, honouring the reference's rotation. |
| `tileRefFromRect(rect, template, tileSize, bounds?, span?)` | `template` moved so its `bounds` start at `rect`. |
| `tileFootprint(size, span?, rotation?)` | The texel `width` and `height` of a region, at least one texel each. |
| `rotateTileBounds(bounds, rotation?)` | `bounds` turned inside the tile. |
| `rotateTileUv(u, v, rotation?)` | A tile-local UV turned the same way. |
| `rescaleTileRef(ref, { blocksetId?, from, to })` | `ref` kept on the same texels after its blockset grid changes from `from` to `to` pixels. `col` and `row` may become fractional. |

`WHOLE_TILE_BOUNDS` and `UNIT_TILE_SPAN` are the defaults.
