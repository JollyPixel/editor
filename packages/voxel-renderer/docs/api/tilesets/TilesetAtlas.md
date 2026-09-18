# TilesetAtlas

One registered atlas: its resolved grid and the texture chunk materials sample.
Obtain it from [`TilesetManager.get()` or `atlas()`](./TilesetManager.md).

```ts
class TilesetAtlas {
  readonly def: ResolvedTilesetDefinition;
  readonly texture: TilesetTexture;

  constructor(definition: TilesetDefinition, texture: TilesetTexture);
  uvFor(
    col: number,
    row: number,
    size?: number,
    span?: Readonly<TileSpan>
  ): TilesetUVRegion;
  updateImage(image: TilesetImage): void;
}

function resolveTilesetDefinition(
  definition: TilesetDefinition,
  size: AtlasSize
): ResolvedTilesetDefinition;
```

The constructor resolves `cols` and `rows` from the image with
`resolveTilesetDefinition()`, then sets nearest-neighbour filtering, sRGB color
space and no mipmaps on `texture`. The atlas does not own the texture:
[`TilesetManager`](./TilesetManager.md) disposes it.

`resolveTilesetDefinition()` keeps explicit `cols` and `rows` and floors the
partial tiles at the image edge out of the derived ones.

## UV regions

`uvFor()` returns the texture rect of a `size` by `size` texel square (default
`def.tileSize`) anchored at the top-left of tile `(col, row)`. `col` and `row`
may be fractional. The rect is inset by half a texel on each side.

`span` stretches the square to the [`tileFootprint()`](./tilesets.md) of
`size`, growing right and down from the same corner. A ramp slope on 16-texel
tiles samples 16 by 23 texels.

Chunk materials clamp every face to its own rect in the shader, so an MSAA
sample taken outside the triangle cannot read a neighbouring tile. See
[rendering and meshing](../../concepts/rendering-and-meshing.md).

## Updating the image

`updateImage()` swaps `texture.image` and flags it for upload. Existing
materials keep the same texture object. The new image must keep the
dimensions the atlas was built with.

```ts
const atlas = engine.tilesetManager.atlas();

atlas.updateImage(editor.textureCanvas());
```
