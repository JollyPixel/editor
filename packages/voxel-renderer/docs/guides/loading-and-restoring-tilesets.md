# Loading and restoring tilesets

Fetch tileset images before constructing the engine. This keeps asynchronous
work outside ECS lifecycle methods.

```ts
import {
  VoxelRenderer,
  loadTilesets
} from "@jolly-pixel/voxel.renderer";

const tilesets = await loadTilesets([
  {
    id: "default",
    src: "tileset.png",
    tileSize: 16
  }
]);

const renderer = actor.addComponentAndGet(VoxelRenderer, {
  tilesets
});
```

Tile references without a `tilesetId` use the first registered atlas.

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
  (definition) => !engine.tilesetManager.has(definition.id)
);

engine.load(snapshot, {
  tilesets: await loadTilesets(missing)
});
```

`load()` throws when the document references an atlas that has not been
registered. See the [tileset reference](../api/tilesets/tilesets.md) for the
underlying loading and registration APIs.
