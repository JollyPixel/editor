# Loading and restoring tilesets

Fetch tileset images before constructing the view. This keeps asynchronous
work outside ECS lifecycle methods.

```ts
import {
  VoxelDocument,
  VoxelView,
  loadTilesets
} from "@jolly-pixel/voxel.renderer";

const tilesets = await loadTilesets([
  {
    id: "default",
    src: "tileset.png",
    tileSize: 16
  }
]);

const document = new VoxelDocument();
const view = new VoxelView(document, {
  tilesets
});
```

Tile references without a `tilesetId` use the first declared tileset.

## Restore a saved world

Load the atlases named by the snapshot before calling `load()`:

```ts
const snapshot = JSON.parse(
  localStorage.getItem("world")!
) as VoxelWorldJSON;

const tilesets = await loadTilesets(snapshot.tilesets);
const document = new VoxelDocument({
  chunkSize: snapshot.chunkSize
});
const view = new VoxelView(document, {
  tilesets
});

view.load(snapshot);
```

If the view already exists, fetch only the missing definitions and pass them
with the load operation:

```ts
const missing = snapshot.tilesets.filter(
  (definition) => !view.atlases.get(definition.id)
);

view.load(snapshot, {
  tilesets: await loadTilesets(missing)
});
```

`load()` declares every tileset of the snapshot. One without atlas logs a
warning and its faces stay hidden until `view.loadTileset()` registers it. See the [tileset reference](../api/tilesets/tilesets.md) for the
underlying loading and registration APIs.
