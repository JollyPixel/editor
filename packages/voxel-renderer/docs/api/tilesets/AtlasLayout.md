# AtlasLayout

Immutable tile grid of a render atlas. Read it from
[`TilesetAtlas.layout`](./TilesetAtlas.md).

```ts
class AtlasLayout {
  static defaultPadding(tileSize: number): number;

  readonly cols: number;
  readonly rows: number;
  readonly tileSize: number;
  readonly padding: number;

  // tileSize plus one gutter on each side
  readonly cellSize: number;
  readonly paddedWidth: number;
  readonly paddedHeight: number;

  constructor(options: AtlasLayoutOptions);

  get isPadded(): boolean;
  withoutPadding(): AtlasLayout;
  sourceBounds(): AtlasRegion;
  uvFor(col: number, row: number): TilesetUVRegion;
  tileRangeWithin(bounds: AtlasRegion): AtlasTileRange | null;
}

interface AtlasLayoutOptions {
  cols: number;
  rows: number;
  tileSize: number;
  /** Default: `0`. */
  padding?: number;
}
```

Instances are frozen.

## Coordinate spaces

Two spaces meet on this class. `AtlasRegion` and `sourceBounds()` count
source-image texels, where tiles sit edge to edge. `cellSize`, `paddedWidth`,
`paddedHeight` and `uvFor()` count padded-canvas texels, where every tile
carries a gutter.

```ts
interface AtlasRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AtlasTileRange {
  colStart: number;
  colEnd: number;
  rowStart: number;
  rowEnd: number;
}
```

## Padding

#### `AtlasLayout.defaultPadding(tileSize: number): number`

Half the tile size, clamped from 2 through 8 texels. It fills in an omitted
`padding` option. See [atlas padding](../../concepts/atlas-padding.md).

#### `isPadded: boolean`

True only when a positive gutter sits over a grid holding at least one tile, so
it doubles as the check that repacking can do anything at all.

#### `withoutPadding(): AtlasLayout`

The same grid with its gutter dropped, or `this` when there is none.
`TilesetAtlas` uses it when an atlas cannot be repacked.

## Tiles

#### `uvFor(col: number, row: number): TilesetUVRegion`

Padded UVs with WebGL Y-flip and a half-texel inset, so a filtered sample never
reads a neighbouring tile.

#### `tileRangeWithin(bounds: AtlasRegion): AtlasTileRange | null`

Tiles the bounds touch, clamped to the grid. A rectangle ending exactly on a
tile boundary stops at the prior tile.

Returns `null` in every case that would redraw nothing: no gutter, empty
bounds, or bounds entirely off the atlas.

#### `sourceBounds(): AtlasRegion`

The whole source image, so `cols * tileSize` by `rows * tileSize`.
