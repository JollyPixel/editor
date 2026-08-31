# TilesetManager

Registry of loaded atlas textures. `VoxelEngine.tilesetManager` exposes the one
the engine uses.

```ts
interface TilesetManagerOptions {
  padding?: number;
}

class TilesetManager {
  readonly defaultTilesetId: string | null;
  readonly version: number;

  constructor(options?: TilesetManagerOptions);
  registerTexture(
    definition: TilesetDefinition,
    texture: THREE.Texture<HTMLImageElement>
  ): TilesetAtlas;
  atlas(tilesetId?: string): TilesetAtlas;
  has(tilesetId?: string): boolean;
  definitions(): ResolvedTilesetDefinition[];
  dispose(): void;
}
```

The first registered tileset becomes the default for references without a
`tilesetId`. `registerTexture()` resolves missing grid dimensions and prepares
the render atlas.

`atlas()` returns the selected atlas or the default. It throws when no tileset
is registered or the requested ID is unknown. `has()` performs the same lookup
without throwing.

`version` increments when registrations change so cached UV data can be
invalidated. `dispose()` disposes every atlas and clears the manager.

`padding` controls the gutter added around each tile. Its default is half the
tile size, clamped from 2 through 8 texels. Set it to `0` to keep source atlases
unchanged. See [atlas padding](../../concepts/atlas-padding.md).
