# Tilesets

Tileset definitions describe atlas images. A [`TilesetList`](#tilesetlist)
holds the ones a world links, `loadTilesets()` fetches their images,
[`TilesetManager`](./TilesetManager.md) registers them, and
[`TilesetAtlas`](./TilesetAtlas.md) provides the texture and UV data used by
materials. The blocks, material groups and tile size a tileset carries live in
a [`TilesetDocument`](./TilesetDocument.md), projected into a world through
its [slot](#projecting-a-tileset-into-a-world).

## Definitions

```ts
interface TilesetAssetReference {
  id: string;
  kind: string;
}

interface TilesetDefinition {
  id: string;
  slot?: number;
  src?: string;
  asset?: TilesetAssetReference;
  tileSize?: number;
  cols?: number;
  rows?: number;
}

type ResolvedTilesetDefinition = TilesetDefinition & {
  tileSize: number;
  cols: number;
  rows: number;
};
```

A tileset takes its pixels from the `src` image URL, or from the catalog asset
named by `asset`. `loadTilesets()` only fetches `src`; the host resolves
`asset` and registers the texture itself.

`slot` is the block id namespace the tileset owns inside the world, from `0`
to `MAX_TILESET_SLOT` (127). A definition declared without one receives the
lowest free slot. Tiles are square and `tileSize` is measured in pixels. A
`src` tileset must declare it; an `asset` tileset may leave it out, since the
asset owns it, and the host declares it with the texture through
`VoxelEngine.loadTileset()`. Missing row and column counts are derived from
the image by [`resolveTilesetDefinition()`](./TilesetAtlas.md), which throws
for a definition still without tile size.

## Tile references

```ts
type TileRotation = 0 | 1 | 2 | 3;

interface ResolvedTileRef {
  col: number;
  row: number;
  tilesetId?: string;
  rotation?: TileRotation;
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
in when it defines a block. `size` is the
square texture region side in texels, anchored at the tile's top-left corner,
and defaults to the tileset `tileSize`. `rotation` turns the tile image
inside the face by clockwise quarter turns in image space, where y points down.
It applies before the block's own `VoxelTransform`, so a rotated block carries
its rotated texture along. An odd rotation swaps the footprint's width and
height; `col` and `row` still name its top-left corner. `resolveTileRef()`
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
```

A tile size is an integer from 1 to `MAX_TILE_SIZE`. `DEFAULT_TILE_SIZE` is
the tile size of a `TilesetDocument` created without one.

## TilesetList

```ts
class TilesetList implements Iterable<TilesetDefinition> {
  readonly version: number;
  readonly size: number;
  readonly defaultTilesetId: string | null;

  constructor(definitions?: Iterable<TilesetDefinition>);
  definitions(): TilesetDefinition[];
  ids(): Set<string>;
  has(tilesetId: string): boolean;
  get(tilesetId: string): TilesetDefinition | undefined;
  bySlot(slot: number): TilesetDefinition | undefined;
  freeSlot(reserved?: Iterable<number>): number | null;
  add(definition: TilesetDefinition): boolean;
  declare(definition: TilesetDefinition): boolean;
  remove(tilesetId: string): boolean;
  replace(definitions: Iterable<TilesetDefinition>): void;
  clear(): void;
}
```

The ordered tilesets a world links, whether or not their texture is loaded.
Definitions are copied in and out, always with a `slot`. `defaultTilesetId`
is the first ID.

`add()` refuses an empty ID, a known ID, a taken or invalid slot, a `src`
tileset without tile size and an invalid tile size; it fills a missing slot
with `freeSlot()`, the lowest one neither held by a tileset nor listed in
`reserved` (`null` once all 128 are taken). `declare()` adds an unknown definition and otherwise replaces the
known one in place, keeping its slot: this is how a host declares the tile
size of an `asset` tileset once loaded. Each mutator returns whether the list
changed, and `version` increases on every change. `replace()` skips the
definitions `add()` would refuse and keeps the first definition of a
duplicated ID; a definition without a slot never takes one another definition
of the same call declares.

## Tileset commands

```ts
function applyTilesetCommand(
  target: VoxelWorldCommandTarget,
  command: VoxelTilesetCommand
): VoxelTilesetCommand | null;
```

Folds a [tileset command](../core/commands.md#tileset-commands) into
`target.tilesets` and returns it, or `null` when nothing changed. A
`tileset-added` comes back with the definition as declared, slot included.
A tileset added without a slot never gets one that voxels of `target.world`
still use, so the voxels a removed tileset left behind are not given the new
tileset's blocks.
[`applyVoxelCommand()`](../core/commands.md#applying-commands) routes tileset
commands to it.

## Projecting a tileset into a world

A [`TilesetDocument`](./TilesetDocument.md) numbers its blocks from `1` and
its tile references name no tileset. A world sees them through the tileset's
slot:

```ts
type TilesetProjection = Pick<TilesetDefinition, "id"> & { slot: number; };

function projectTilesetBlock(
  tileset: TilesetProjection,
  block: ResolvedBlockDefinition
): ResolvedBlockDefinition;
function projectTilesetBlocks(
  tileset: TilesetProjection,
  blocks: Iterable<ResolvedBlockDefinition>
): ResolvedBlockDefinition[];
function localTilesetBlock(
  tileset: TilesetProjection,
  block: ResolvedBlockDefinition
): ResolvedBlockDefinition;
function belongsToTileset(
  tileset: Pick<TilesetProjection, "slot">,
  blockId: number
): boolean;

function projectTilesetMaterialGroup(
  tileset: TilesetProjection,
  group: MaterialGroupJSON
): MaterialGroupJSON;
function projectTilesetMaterialGroups(
  tileset: TilesetProjection,
  groups: Iterable<MaterialGroupJSON>
): MaterialGroupJSON[];
function projectedMaterialGroupId(
  tileset: TilesetProjection,
  groupId: string
): string;
function localMaterialGroupId(
  tileset: TilesetProjection,
  groupId: string
): string;
```

`projectTilesetBlock()` gives a block the id
[`composeBlockId(slot, block.id)`](../blocks/BlockDefinition.md#block-ids),
names the tileset in every tile reference and prefixes its material group
with `"<tilesetId>/"`. `localTilesetBlock()` is the inverse.
`belongsToTileset()` tells whether a world block id was projected from the
slot. Material groups are projected the same way, so two tilesets may both
define a `"metal"` group. Register the projected blocks and groups on the
engine with `defineBlocks()` and `defineMaterialGroup()`; replay a tileset
document's commands the same way to keep a world in step with it.

## Rescaling and tile rectangles

```ts
interface TileRescale {
  tilesetId?: string;
  from: number;
  to: number;
}

function rescaleTileRef(ref: ResolvedTileRef, rescale: TileRescale): ResolvedTileRef;
```

`rescaleTileRef()` keeps a reference on the same texels when its tileset grid
changes from `from` to `to` pixels: `col` and `row` are multiplied by
`from / to` and may become fractional, and a missing `size` becomes `from`.
References to another tileset are returned unchanged; a rescale without
`tilesetId` matches the references that name none, as in a tileset document.

```ts
interface TileBounds {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

const WHOLE_TILE_BOUNDS: Readonly<TileBounds>;
const UNIT_TILE_SPAN: Readonly<TileSpan>;

interface TileSpan {
  u: number;
  v: number;
}

interface TileRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function tileFootprint(
  size: number,
  span?: Readonly<TileSpan>,
  rotation?: TileRotation
): Pick<TileRect, "width" | "height">;
function rotateTileUv(
  u: number,
  v: number,
  rotation?: TileRotation
): [number, number];
function rotateTileBounds(
  bounds: Readonly<TileBounds>,
  rotation?: TileRotation
): TileBounds;
function tileRectOf(
  ref: ResolvedTileRef,
  tileSize: number,
  bounds?: TileBounds,
  span?: Readonly<TileSpan>
): TileRect;
function tileRefFromRect(
  rect: Pick<TileRect, "x" | "y">,
  template: ResolvedTileRef,
  tileSize: number,
  bounds?: TileBounds,
  span?: Readonly<TileSpan>
): ResolvedTileRef;
```

`TileBounds` is a normalized rect inside a tile with `v` pointing up; shape
texture layouts use it for their slots. `tileRectOf()` returns the texel rectangle, origin at the top-left of the
image, that `bounds` (default `WHOLE_TILE_BOUNDS`) covers inside a reference.
`tileRefFromRect()` is its inverse: it moves `template` so its `bounds` start
at `rect`.

`TileSpan` is a slot's size in tiles, above `1` on a slanted face such as a
ramp slope (`{ u: 1, v: √2 }`). `tileFootprint()` rounds `size * span` to whole
texels, never below one: a slope is 11, 23, 45 and 91 texels tall on 8, 16, 32
and 64-texel tiles. `tileRectOf()` and `tileRefFromRect()` apply it with a
default of `UNIT_TILE_SPAN`, so a spanned rect grows down from the tile's
top-left corner.

Both also honour the reference's `rotation`: the footprint swaps its sides and
`bounds` turn inside it with `rotateTileBounds()`. `rotateTileUv()` turns a
tile-local UV the same way; the mesher applies it to every face vertex.

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

Definitions are fetched in parallel. A duplicate ID is fetched once, and a
definition without `src` is skipped. The
optional `manager` reports Three.js loading progress; `loader` allows callers
to supply a compatible texture loader. Pass the result through
`VoxelEngineOptions.tilesets`.

The [loading and restoring tilesets guide](../../guides/loading-and-restoring-tilesets.md)
shows initial loading and saved-world restoration.

## Classes

- [`TilesetDocument`](./TilesetDocument.md) is one tileset's blocks, material
  groups and tile size.
- [`TilesetManager`](./TilesetManager.md) registers loaded atlas textures.
- [`TilesetAtlas`](./TilesetAtlas.md) is one atlas: its grid, texture and UVs.
