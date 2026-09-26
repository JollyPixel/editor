<h1 align="center">
  voxel.tiled
</h1>

<p align="center">
  Tiled map import for <code>@jolly-pixel/voxel.renderer</code>
</p>

## 💃 Getting Started

This experimental package is private to the workspace. It converts Tiled `.tmj` maps into `VoxelWorldJSON` snapshots, with their generated blocks, in `"stacked"` or `"flat"` layer modes. Add `"@jolly-pixel/voxel.tiled": "workspace:*"` to another workspace's dependencies, together with its peers `@jolly-pixel/voxel.renderer`, `@jolly-pixel/asset`, `@jolly-pixel/engine` and `three`.

## 👀 Usage example

```ts
import { loadJSON } from "@jolly-pixel/engine";
import {
  VoxelEngine,
  loadTilesets
} from "@jolly-pixel/voxel.renderer";
import {
  TiledConverter,
  type TiledMap
} from "@jolly-pixel/voxel.tiled";

const map = await loadJSON<TiledMap>("map.tmj");
const { world, blocks } = new TiledConverter().convert(map, {
  resolveTilesetSrc: (_source, id) => `assets/${id}.png`,
  layerMode: "stacked"
});

const engine = new VoxelEngine({
  tilesets: await loadTilesets(world.tilesets),
  blocks
});
engine.load(world);
```

## 📚 Documentation

- [Importing a Tiled map](docs/guides/importing-a-tiled-map.md)
- [`TiledConverter`](docs/api/TiledConverter.md), including the Tiled JSON types
- [`TiledMapAssetLoader`](docs/api/TiledMapAssetLoader.md), which packages a
  converted map as one `@jolly-pixel/asset` value

## 🚀 Running the example

```bash
pnpm --filter @jolly-pixel/voxel.tiled dev
```

`http://localhost:5173/` loads a multi-layer `.tmj` map through `TiledMapAssetLoader` in `"stacked"` mode.

## License
MIT
