# Atlas padding

Atlases are unpadded by default. Chunk materials clamp every face to its own
atlas rect in the shader, which keeps a sample inside the intended tile without
separating tiles in the texture.

MSAA can shade a partially covered pixel at a point outside the triangle, so
the interpolated UV may reach past the intended tile. The clamp pulls it back.

A replicated-edge gutter is the older way to bound that sample. It also makes a
tile addressable only by whole-tile indices: a gutter holds copies of the
tile's own border, not its neighbour's pixels, so a UV rect sitting at a
fractional offset, or straddling two tiles, has no representation in a padded
atlas and samples the gutter instead.

## Optional padding

Padding defaults to `0`. Set `VoxelEngineOptions.tilesetPadding` to a positive
value to repack with gutters, sized by
[`AtlasLayout.defaultPadding()`](../api/tilesets/AtlasLayout.md#padding) when
you want the previous behaviour.

```ts
const engine = new VoxelEngine({
  tilesets,
  tilesetPadding: 4
});
```

The render texture then grows by `2 * padding` in each dimension for every
cell: a 16 px tile with 8 px of padding uses a 32 px render cell, four times
the texture memory of the unpadded default.

## Source and render textures

[`TilesetAtlas.sourceTexture`](../api/tilesets/TilesetAtlas.md) keeps the
original grid. `texture` is the texture used by chunk materials, and aliases
`sourceTexture` unless the atlas was repacked with a gutter. `uvFor()` always
returns coordinates for `texture`.

Use `updateSource()` after editing the original grid. A bounded update limits
the redraw to tiles intersecting the supplied source-image rectangle.

## Environments without canvas

Repacking requires a 2D canvas. In Node.js or SSR environments without one, a
requested gutter is dropped: `layout.padding` is `0`, `texture` aliases
`sourceTexture`, and UVs use the original grid.
