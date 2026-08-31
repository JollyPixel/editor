# TilesetAtlas

One registered atlas: its resolved grid, its [layout](./AtlasLayout.md), and its
source and render textures. Obtain it from
[`TilesetManager.atlas()`](./TilesetManager.md).

```ts
class TilesetAtlas {
  readonly def: ResolvedTilesetDefinition;
  readonly layout: AtlasLayout;
  readonly sourceTexture: TilesetTexture;
  readonly texture: TilesetTexture;

  constructor(
    definition: TilesetDefinition,
    texture: THREE.Texture<HTMLImageElement>,
    padding?: number | null
  );
  uvFor(col: number, row: number): TilesetUVRegion;
  updateSource(
    image: TilesetImage,
    bounds?: AtlasRegion
  ): void;
  dispose(): void;
}
```

An omitted or `null` padding value uses the default for the tile size. The
constructor applies nearest-neighbour filtering, sRGB color space, and disables
mipmap generation on the render texture.

## Textures

`sourceTexture` preserves the original atlas grid used by editing tools.
`texture` is bound to materials and may contain padded cells. `uvFor()` returns
coordinates for the render texture.

An atlas that cannot be repacked, such as in an environment without a canvas,
reports `layout.padding` of `0` and aliases `texture` to `sourceTexture`.

## Updating the source

`updateSource()` replaces the source image and rebuilds the padded texture. The
new image must keep the dimensions used at registration. Both texture objects
are updated in place, so existing materials stay valid.

Pass `bounds` for an editor update that changed only part of the source atlas.
The rectangle uses source texels and redraws only intersecting tiles. Omit it
for a complete replacement, resize, or tileset switch.

```ts
const atlas = engine.tilesetManager.atlas();
const dirty = bridge.consume();

if (dirty !== null) {
  atlas.updateSource(editor.textureCanvas(), dirty);
}
```

`dispose()` disposes both textures.
