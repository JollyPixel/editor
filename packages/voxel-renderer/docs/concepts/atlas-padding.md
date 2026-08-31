# Atlas padding

Voxel-renderer surrounds each atlas tile with replicated edge texels before it
binds the texture to a material. The gutter prevents filtered samples near a
triangle edge from reading a neighbouring tile.

MSAA can shade a partially covered pixel at a point outside the triangle. The
interpolated UV may then extend past the intended tile. A gutter makes that
sample land on a copy of the tile's own border.

## Default padding

Padding defaults to half the tile size, clamped from 2 through 8 texels. Set
`VoxelEngineOptions.tilesetPadding` to `0` to disable repacking.

```ts
const engine = new VoxelEngine({
  tilesets,
  tilesetPadding: 4
});
```

The render texture grows by `2 * padding` in each dimension for every cell. A
16 px tile with 8 px of padding therefore uses a 32 px render cell. Source
atlases are normally small, but editing tools should account for that extra GPU
memory.

## Source and render textures

`TilesetAtlas.sourceTexture` keeps the original grid. `texture` contains the
padded atlas and is the texture used by chunk materials. `uvFor()` always
returns coordinates for `texture`.

Use `updateSource()` after editing the original grid. A bounded update limits
the redraw to tiles intersecting the supplied source-image rectangle.

## Environments without canvas

Repacking requires a 2D canvas. In Node.js or SSR environments without one,
the atlas remains unpadded: `layout.padding` is `0`, `texture` aliases
`sourceTexture`, and UVs use the original grid.
