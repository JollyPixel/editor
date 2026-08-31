# TiledMapAssetLoader

`TiledMapAssetLoader` converts a Tiled map and prepares its atlas textures as one
`@jolly-pixel/asset` value.

## API

```ts
type TiledMapAssetLoaderOptions = Omit<
  TiledConverterOptions,
  "resolveTilesetSrc"
>;

interface VoxelTiledMap {
  readonly world: VoxelWorldJSON;
  readonly tilesets: TilesetSource[];
}

const TiledMapAssetType: AssetType<VoxelTiledMap>;

type VoxelTiledMapAsset = AssetReference<VoxelTiledMap>;

class TiledMapAssetLoader implements AssetLoader<VoxelTiledMap> {
  constructor(
    manager?: THREE.LoadingManager,
    options?: TiledMapAssetLoaderOptions
  );

  load(record: AssetRecord): Promise<VoxelTiledMap>;
}
```

The loader fetches the `.tmj` record, converts it, and loads every referenced
tileset. A `.tsx` reference is resolved to a `.png` file beside the map source.
Its default layer mode is `"stacked"`; direct `TiledConverter` calls default to
`"flat"`.

Register `TiledMapAssetType` and the loader with the runtime asset system. The
returned `world` and `tilesets` can be passed directly to `VoxelRenderer` and
`VoxelEngine.load()`.
