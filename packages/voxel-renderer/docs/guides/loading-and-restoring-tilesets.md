# Loading and restoring tilesets

Fetch tileset images before constructing the engine. This keeps asynchronous
work outside ECS lifecycle methods.

```ts
import {
  VoxelEngine,
  loadTilesets
} from "@jolly-pixel/voxel.renderer";

const tilesets = await loadTilesets([
  {
    id: "default",
    src: "tileset.png",
    tileSize: 16
  }
]);

const engine = new VoxelEngine({
  tilesets
});
```

Tile references without a `tilesetId` use the first declared tileset.

## Restore a saved world

Load the atlases named by the document before calling `load()`:

```ts
const snapshot = JSON.parse(
  localStorage.getItem("world")!
) as VoxelWorldJSON;

const tilesets = await loadTilesets(snapshot.tilesets);
const engine = new VoxelEngine({
  chunkSize: snapshot.chunkSize,
  tilesets
});

engine.load(snapshot);
```

If the engine already exists, fetch only the missing definitions and pass them
with the load operation:

```ts
const missing = snapshot.tilesets.filter(
  (definition) => !engine.tilesetManager.get(definition.id)
);

engine.load(snapshot, {
  tilesets: await loadTilesets(missing)
});
```

`load()` declares every tileset of the document. One without atlas logs a
warning and its faces stay hidden until `engine.loadTileset()` registers it. See the [tileset reference](../api/tilesets/tilesets.md) for the
underlying loading and registration APIs.
