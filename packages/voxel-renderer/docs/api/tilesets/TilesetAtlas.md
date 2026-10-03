# TilesetAtlas

One registered atlas: its resolved grid and the texture chunk materials sample.
Obtain it from [`TilesetAtlases.get()` or `atlas()`](./TilesetAtlases.md).

```ts
class TilesetAtlas<TTexture extends THREE.Texture<AtlasSize> = TilesetTexture> {
  readonly def: ResolvedTilesetDefinition;
  readonly texture: TTexture;
  readonly normal: TilesetNormalTexture | null;

  constructor(
    definition: TilesetDefinition,
    texture: TTexture,
    normal?: TilesetNormalTexture | null
  );
  uvFor(
    col: number,
    row: number,
    size?: number,
    span?: Readonly<TileSpan>,
    rotation?: TileRotation
  ): TilesetUVRegion;
  updateImage(image: TTexture["image"]): void;
  updateNormal(image: AtlasSize): void;
  disposeReplacedBy(next: TilesetAtlas<TTexture>): void;
  dispose(): void;
}

type TilesetNormalTexture = THREE.Texture<AtlasSize>;

function resolveTilesetDefinition(
  definition: TilesetDefinition,
  size: AtlasSize
): ResolvedTilesetDefinition;

function tileUvRegion(
  definition: ResolvedTilesetDefinition,
  col: number,
  row: number,
  size?: number,
  span?: Readonly<TileSpan>,
  rotation?: TileRotation
): TilesetUVRegion;
```

The constructor resolves `cols` and `rows` from the image with
`resolveTilesetDefinition()`, then sets nearest-neighbour filtering, sRGB color
space and no mipmaps on `texture`.

`normal` is an optional tangent-space normal atlas, `null` by default. It gets
the same filtering but `NoColorSpace`, and must share the layout and
orientation of `texture`. See
[normal maps](../../concepts/rendering-and-meshing.md#normal-maps).

`resolveTilesetDefinition()` keeps explicit `cols` and `rows` and floors the
partial tiles at the image edge out of the derived ones.

## UV regions

`uvFor()` returns the texture rect of a `size` by `size` texel square (default
`def.tileSize`) anchored at the top-left of tile `(col, row)`. `col` and `row`
may be fractional. The rect is inset by half a texel on each side.
`tileUvRegion()` computes the same rect from a resolved definition alone, for
code without a texture such as a mesh worker.

`span` stretches the square to the [`tileFootprint()`](./tilesets.md) of
`size`, growing right and down from the same corner. A ramp slope on 16-texel
tiles samples 16 by 23 texels. An odd `rotation` swaps that footprint, so the
same slope turned a quarter samples 23 by 16 texels.

Chunk materials clamp every face to its own rect in the shader, so an MSAA
sample taken outside the triangle cannot read a neighbouring tile. See
[rendering and meshing](../../concepts/rendering-and-meshing.md).

## Updating the image

`updateImage()` swaps `texture.image` and flags it for upload. Existing
materials keep the same texture object. The new image must keep the
dimensions the atlas was built with.

```ts
const atlas = view.atlases.atlas();

atlas.updateImage(editor.textureCanvas());
```

`updateNormal()` does the same for `normal`, and throws when the atlas has no
normal texture. Attaching or removing one goes through
[`VoxelView.loadTileset()`](../core/VoxelView.md#methods), which rebuilds the
chunk materials.

## Disposal

`dispose()` disposes `texture` and `normal`. `disposeReplacedBy()` disposes
only those `next` does not reuse, so registering the same texture again keeps
it alive. [`TilesetAtlases`](./TilesetAtlases.md) calls both when it replaces
or drops an atlas; code that builds an atlas itself disposes it.
