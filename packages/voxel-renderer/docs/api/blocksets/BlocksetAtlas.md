# BlocksetAtlas

One loaded blockset: its resolved grid and the texture chunk materials sample.
Get it from [`view.atlases`](./BlocksetAtlases.md).

```ts
const atlas = view.atlases.atlas("terrain");

atlas.uvFor(2, 0); // { offsetU, offsetV, scaleU, scaleV }
atlas.updateImage(paintedCanvas);
```

## Constructor

```ts
new BlocksetAtlas(
  definition: BlocksetDefinition,
  texture: TTexture,
  normal?: AtlasNormalTexture | null
)
```

Sets nearest-neighbour filtering, sRGB colour space and no mipmaps on
`texture`. Throws when the definition has no `tileSize`. An atlas you build
yourself is yours to dispose; the ones `view.atlases` builds are disposed for
you.

## Properties

| Property | Type | Description |
| --- | --- | --- |
| `def` | `ResolvedBlocksetDefinition` | The definition with `tileSize`, `cols` and `rows` filled in. |
| `texture` | `AtlasTexture` | The atlas image. |
| `normal` | `AtlasNormalTexture \| null` | See [normal atlas](#normal-atlas). |

`cols` and `rows` missing from the definition are derived from the image,
ignoring partial tiles at the edges. `resolveBlocksetDefinition(definition,
size)` does the same without a texture.

## Methods

#### `uvFor(col: number, row: number, size?: number, span?: TileSpan, rotation?: TileRotation): AtlasUVRegion`

The texture rectangle of a `size` by `size` texel region (default
`def.tileSize`) anchored at the top-left of tile `(col, row)`. `span` and
`rotation` change its footprint as in
[`tileFootprint()`](./blocksets.md#tile-geometry). `col` and `row` may be
fractional. `tileUvRegion(definition, ...)` computes the same rectangle from a
resolved definition alone.

```ts
interface AtlasUVRegion {
  offsetU: number;
  offsetV: number;
  scaleU: number;
  scaleV: number;
}
```

#### `updateImage(image: AtlasImage): void`

Swaps the texture image and flags it for upload; materials keep the same
texture. The image must keep the size the atlas was built with.

#### `updateNormal(image: AtlasSize): void`

Same for the normal atlas. Throws when the atlas has none.

#### `dispose(): void`

Disposes `texture` and `normal`.

## Normal atlas

`normal` is an optional tangent-space normal map with the same layout as
`texture`. It gets the same filtering, without a colour space. Add or remove it
through [`view.loadBlockset()`](../core/VoxelView.md), which rebuilds the chunk
materials. See [normal maps](../../concepts/rendering-and-meshing.md#normal-maps).
