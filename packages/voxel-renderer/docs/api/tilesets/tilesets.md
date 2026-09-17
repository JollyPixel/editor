# Tilesets

Tileset definitions describe atlas images. A [`TilesetList`](#tilesetlist)
holds the ones a world declares, `loadTilesets()` fetches their images,
[`TilesetManager`](./TilesetManager.md) registers them, and
[`TilesetAtlas`](./TilesetAtlas.md) provides the texture and UV data used by
materials, through an [`AtlasLayout`](./AtlasLayout.md).

## Definitions and tile references

```ts
interface TilesetDefinition {
  id: string;
  src: string;
  tileSize: number;
  cols?: number;
  rows?: number;
}

type ResolvedTilesetDefinition = TilesetDefinition & {
  cols: number;
  rows: number;
};

function resolveTilesetDefinition(
  definition: TilesetDefinition,
  size: AtlasSize
): ResolvedTilesetDefinition;
```

Tiles are square and `tileSize` is measured in pixels. Missing row and column
counts are derived from the image dimensions. Partial tiles at an image edge
are excluded by flooring the result. Explicit counts are preserved.

```ts
interface ResolvedTileRef {
  col: number;
  row: number;
  tilesetId?: string;
  size?: number;
}

type Coords = [col: number, row: number];
type TileRef = Coords | ResolvedTileRef;

function resolveTileRef(
  reference: TileRef,
  defaultTilesetId?: string
): ResolvedTileRef;
```

A missing `tilesetId` selects the first declared tileset; the engine fills it
in when it loads or defines a block. `size` is the
square texture region side in texels, anchored at the tile's top-left corner,
and defaults to the tileset `tileSize`. `resolveTileRef()`
expands tuple references and fills the default ID without mutating the input.

The supporting texture and atlas types are:

```ts
interface AtlasSize {
  width: number;
  height: number;
}

interface TilesetUVRegion {
  offsetU: number;
  offsetV: number;
  scaleU: number;
  scaleV: number;
}

type TilesetImage = HTMLImageElement | HTMLCanvasElement;
type TilesetTexture = THREE.Texture<TilesetImage>;
```

## Tile sizes

```ts
const MAX_TILE_SIZE = 4096;
const DEFAULT_TILE_SIZE = 32;

function isTileSize(value: unknown): value is number;
function powerOfTwoTileSizes(min?: number, max?: number): number[];
```

A tile size is an integer from 1 to `MAX_TILE_SIZE`. `DEFAULT_TILE_SIZE` is
used when a document sets no `defaultTileSize`. `powerOfTwoTileSizes()` lists
the powers of two within `min` and `max` (defaults `1` and `MAX_TILE_SIZE`),
for size pickers.

## TilesetList

```ts
class TilesetList implements Iterable<TilesetDefinition> {
  readonly version: number;
  readonly size: number;
  readonly defaultTilesetId: string | null;
  readonly defaultTileSize: number | undefined;
  readonly preferredTileSize: number;

  constructor(
    definitions?: Iterable<TilesetDefinition>,
    defaultTileSize?: number
  );
  definitions(): TilesetDefinition[];
  ids(): Set<string>;
  has(tilesetId: string): boolean;
  get(tilesetId: string): TilesetDefinition | undefined;
  add(definition: TilesetDefinition): boolean;
  remove(tilesetId: string): boolean;
  resize(tilesetId: string, tileSize: number): boolean;
  updateDefaultTileSize(tileSize: number): boolean;
  replace(
    definitions: Iterable<TilesetDefinition>,
    defaultTileSize?: number
  ): void;
  clear(): void;
}
```

The ordered tilesets a world declares, whether or not their texture is loaded.
Definitions are copied in and out. `defaultTilesetId` is the first ID.
`preferredTileSize` is `defaultTileSize` or `DEFAULT_TILE_SIZE`.

`add()` refuses an empty ID, a known ID or an invalid tile size. `resize()`
refuses an unknown ID, an invalid or unchanged size, and drops the stored
`cols` and `rows`. Each mutator returns whether the list changed, and
`version` increases on every change. `replace()` keeps the first definition of
a duplicated ID and ignores an invalid `defaultTileSize`.

## Tileset commands

```ts
interface TilesetDocument {
  readonly tilesets: TilesetList;
  readonly blocks: BlockRegistry;
}

function applyTilesetCommand(
  document: TilesetDocument,
  command: VoxelTilesetCommand
): boolean;
```

Folds a [tileset command](../core/commands.md#tileset-commands) into a document and
returns whether it changed. `tileset-resized` also rescales, in `blocks`,
every tile reference on that tileset with `rescaleTileRef()`.
[`applyVoxelCommand()`](../core/commands.md#applying-commands) routes tileset
commands to it.

## Rescaling and tile rectangles

```ts
interface TileRescale {
  tilesetId: string;
  from: number;
  to: number;
}

function rescaleTileRef(ref: ResolvedTileRef, rescale: TileRescale): ResolvedTileRef;
function rescaleBlockTiles(
  block: ResolvedBlockDefinition,
  rescale: TileRescale
): ResolvedBlockDefinition;
function rescaleLeavesBlocksOffGrid(
  blocks: Iterable<ResolvedBlockDefinition>,
  rescale: TileRescale
): boolean;
```

`rescaleTileRef()` keeps a reference on the same texels when its tileset grid
changes from `from` to `to` pixels: `col` and `row` are multiplied by
`from / to` and may become fractional, and a missing `size` becomes `from`.
References to another tileset are returned unchanged, and so is a block that
uses none. `rescaleLeavesBlocksOffGrid()` reports whether any reference would
land between tiles.

```ts
const WHOLE_TILE_BOUNDS: Readonly<ShapeTextureBounds>;

interface TileRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function tileRectOf(
  ref: ResolvedTileRef,
  tileSize: number,
  bounds?: ShapeTextureBounds
): TileRect;
function tileRefFromRect(
  rect: Pick<TileRect, "x" | "y">,
  template: ResolvedTileRef,
  tileSize: number,
  bounds?: ShapeTextureBounds
): ResolvedTileRef;
```

`tileRectOf()` returns the texel rectangle, origin at the top-left of the
image, that `bounds` (default `WHOLE_TILE_BOUNDS`) covers inside a reference.
`tileRefFromRect()` is its inverse: it moves `template` so its `bounds` start
at `rect`.

## Loading textures

Use `loadTilesets()` before constructing a `VoxelEngine`.

```ts
interface TilesetSource {
  def: TilesetDefinition;
  texture: THREE.Texture<HTMLImageElement>;
}

interface TextureSourceLoader {
  loadAsync(
    url: string
  ): Promise<THREE.Texture<HTMLImageElement>>;
}

interface LoadTilesetsOptions {
  manager?: THREE.LoadingManager;
  loader?: TextureSourceLoader;
}

function loadTilesets(
  definitions: Iterable<TilesetDefinition>,
  options?: LoadTilesetsOptions
): Promise<TilesetSource[]>;
```

Definitions are fetched in parallel. A duplicate ID is fetched once. The
optional `manager` reports Three.js loading progress; `loader` allows callers
to supply a compatible texture loader. Pass the result through
`VoxelEngineOptions.tilesets`.

The [loading and restoring tilesets guide](../../guides/loading-and-restoring-tilesets.md)
shows initial loading and saved-world restoration.

## Classes

- [`TilesetManager`](./TilesetManager.md) registers loaded atlas textures.
- [`TilesetAtlas`](./TilesetAtlas.md) owns one atlas and its two textures.
- [`AtlasLayout`](./AtlasLayout.md) is the tile grid, padded and unpadded.
