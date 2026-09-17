# TilesetManager

Registry of the declared tilesets and their loaded atlas textures.
`VoxelEngine.tilesetManager` exposes the one the engine uses.

```ts
interface TilesetManagerOptions {
  padding?: number;
  tilesets?: TilesetList;
}

class TilesetManager {
  readonly tilesets: TilesetList;
  readonly defaultTilesetId: string | null;
  readonly version: number;

  constructor(options?: TilesetManagerOptions);
  registerTexture(
    definition: TilesetDefinition,
    texture: TilesetTexture
  ): TilesetAtlas;
  unregisterTexture(tilesetId: string): boolean;
  syncAtlases(): string[];
  atlas(tilesetId?: string): TilesetAtlas;
  has(tilesetId?: string): boolean;
  definitions(): TilesetDefinition[];
  dispose(): void;
}
```

`tilesets` is the [`TilesetList`](./tilesets.md#tilesetlist) of declared
tilesets, created empty unless one is passed. A declared tileset may have no
atlas yet. `definitions()` returns copies of the declared definitions, and
`defaultTilesetId` is the first declared ID, used by references without a
`tilesetId`.

`registerTexture()` declares the tileset when its ID is unknown, then builds
the atlas from the declared definition; `cols` and `rows` fall back to the
passed definition, then to the image size. Registering an existing ID disposes
and replaces its atlas.

`unregisterTexture()` disposes the atlas, keeps the declaration and reports
whether an atlas was there.

`syncAtlases()` realigns atlases after the list changed: it disposes the atlas
of an undeclared tileset and rebuilds, on the same source texture, the atlas of
a tileset whose `tileSize` changed. It returns the affected IDs.

`atlas()` returns the selected atlas or the default. It throws when no tileset
is declared or the requested atlas is not loaded. `has()` performs the same
lookup without throwing.

`version` increases when atlases or the list change, so cached UV data can be
invalidated. `dispose()` disposes every atlas and clears the list.

`padding` controls the gutter added around each tile. Its default is half the
tile size, clamped from 2 through 8 texels. Set it to `0` to keep source atlases
unchanged. See [atlas padding](../../concepts/atlas-padding.md).
