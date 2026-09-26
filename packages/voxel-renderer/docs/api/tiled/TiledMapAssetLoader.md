# TiledMapAssetLoader

`TiledMapAssetLoader` converts a Tiled map and prepares its atlas textures as one
`@jolly-pixel/asset` value. It is exported from
`@jolly-pixel/voxel.renderer/engine`, which requires the optional peers
`@jolly-pixel/asset` and `@jolly-pixel/engine`.

## API

```ts
type TiledMapAssetLoaderOptions = Omit<
  TiledConverterOptions,
  "resolveTilesetSrc"
>;

interface VoxelTiledMap {
  readonly world: VoxelWorldJSON;
  readonly blocks: ResolvedBlockDefinition[];
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
returned `blocks` and `tilesets` can be passed to `VoxelEngine`, and `world`
to `VoxelEngine.load()`.
