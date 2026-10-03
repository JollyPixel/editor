# Tilesets

A tileset is an atlas image cut into square tiles that block faces sample.

- `document.tilesets`, a [`TilesetList`](#tilesetlist), holds the tileset
  definitions a world links.
- [`loadTilesets()`](#loading-textures) fetches their images.
- [`TilesetAtlases`](./TilesetAtlases.md) and
  [`TilesetAtlas`](./TilesetAtlas.md) hold the loaded textures of a view.
- A [`TilesetDocument`](./TilesetDocument.md) holds the blocks, material
  groups and tile size that belong to one tileset; a
  [`TilesetLink`](./TilesetLink.md) projects it into a world.

```ts
const tilesets = await loadTilesets([
  { id: "terrain", src: "terrain.png", tileSize: 16 }
]);
const view = new VoxelView(document, { tilesets });
```

## Definitions

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Required, unique. |
| `src` | `string` | Image URL, fetched by `loadTilesets()`. |
| `asset` | `{ id: string; kind: string }` | A catalog asset the host loads itself instead of `src`. |
| `slot` | `number` | Block id namespace the tileset owns in the world, `0` to `MAX_TILESET_SLOT` (127). Defaults to the lowest free slot. |
| `tileSize` | `number` | Tile side in pixels. Required with `src`; an `asset` tileset may declare it later through `VoxelView.loadTileset()`. |
| `cols`, `rows` | `number` | Derived from the image when missing. |

A tile size is an integer from 1 to `MAX_TILE_SIZE` (4096); `isTileSize()`
checks one. `DEFAULT_TILE_SIZE` (32) is the tile size of a `TilesetDocument`
created without one.

## Tile references

Blocks name their textures with tile references.

```ts
type TileRef = [col: number, row: number] | ResolvedTileRef;

interface ResolvedTileRef {
  col: number;
  row: number;
  tilesetId?: string;
  rotation?: 0 | 1 | 2 | 3;
  size?: number;
}
```

| Field | Default | Description |
| --- | --- | --- |
| `col`, `row` | | Top-left tile of the region. |
| `tilesetId` | first declared tileset | Filled in when a block is defined. |
| `rotation` | `0` | Clockwise quarter turns of the tile image on the face. Applies before the voxel's own rotation. |
| `size` | tileset `tileSize` | Side of the square region in texels. |

`resolveTileRef(ref, defaultTilesetId?)` expands a tuple and fills the default
tileset id without mutating its input.

## TilesetList

The ordered tileset definitions a world links, loaded or not. Definitions are
copied in and out, always with a `slot`. Changing the list directly emits no
command; use `document.addTileset()` and `document.removeTileset()` to share
changes with peers.

| Member | Description |
| --- | --- |
| `size` | Number of tilesets. |
| `version` | Increases on every change. |
| `defaultTilesetId` | The first id, or `null`. |
| `definitions()` | Copies of every definition. |
| `ids()`, `has(id)`, `get(id)` | Lookups. |
| `bySlot(slot)` | The tileset owning a slot. |
| `freeSlot(reserved?)` | The lowest slot neither used nor in `reserved`, or `null` when all 128 are taken. |
| `add(definition)` | Adds a tileset. Refuses an empty or known id, a taken or invalid slot, an invalid tile size, and a `src` tileset without tile size. |
| `declare(definition)` | Adds an unknown tileset, or replaces a known one and keeps its slot. |
| `remove(id)`, `replace(definitions)`, `clear()` | `replace()` skips what `add()` refuses and keeps the first of duplicated ids. |

Each mutator returns whether the list changed.

## Loading textures

```ts
function loadTilesets(
  definitions: Iterable<TilesetDefinition>,
  options?: { manager?: THREE.LoadingManager; loader?: TextureSourceLoader }
): Promise<TilesetSource[]>;

interface TilesetSource {
  def: TilesetDefinition;
  texture: THREE.Texture<HTMLImageElement>;
  normal?: TilesetNormalTexture;
}
```

Fetches the `src` images in parallel and resolves with one source per id;
definitions without `src` are skipped. `loader` replaces the default
`THREE.TextureLoader`, which is the only thing `manager` is passed to. Pass the
result to `VoxelViewOptions.tilesets` or `view.load()`. `normal` is never
filled; add a [normal atlas](../../concepts/rendering-and-meshing.md#normal-maps)
yourself.

## Tile geometry

Helpers for editors that draw or pick tile regions. Texel rectangles have their
origin at the top-left of the image. `TileBounds` (`u0, v0, u1, v1`) is a
normalized rectangle inside a tile with `v` up; `TileSpan` (`u, v`) is a face
slot's size in tiles, such as `{ u: 1, v: √2 }` on a ramp slope.

| Function | Returns |
| --- | --- |
| `tileRectOf(ref, tileSize, bounds?, span?)` | The `TileRect` (`x, y, width, height`) in texels that `bounds` covers, honouring the reference's rotation. |
| `tileRefFromRect(rect, template, tileSize, bounds?, span?)` | `template` moved so its `bounds` start at `rect`. |
| `tileFootprint(size, span?, rotation?)` | The texel `width` and `height` of a region, at least one texel each. |
| `rotateTileBounds(bounds, rotation?)` | `bounds` turned inside the tile. |
| `rotateTileUv(u, v, rotation?)` | A tile-local UV turned the same way. |
| `rescaleTileRef(ref, { tilesetId?, from, to })` | `ref` kept on the same texels after its tileset grid changes from `from` to `to` pixels. `col` and `row` may become fractional. |

`WHOLE_TILE_BOUNDS` and `UNIT_TILE_SPAN` are the defaults.
