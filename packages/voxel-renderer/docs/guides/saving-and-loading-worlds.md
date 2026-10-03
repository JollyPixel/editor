# Saving and loading worlds

## Loading tilesets

Fetch tileset images before constructing the view, so no asynchronous work
runs inside ECS lifecycle methods:

```ts
import {
  VoxelDocument,
  VoxelView,
  loadTilesets
} from "@jolly-pixel/voxel.renderer";

const document = new VoxelDocument();
const view = new VoxelView(document, {
  tilesets: await loadTilesets([
    { id: "default", src: "tileset.png", tileSize: 16 }
  ])
});
```

Tile references without a `tilesetId` use the first declared tileset.

## Saving

`VoxelDocument.save()` returns plain JSON with the layers, object layers,
templates and the declared tilesets. Blocks are not saved with the world:
save them with the tileset they belong to (see
[`TilesetDocument`](../api/tilesets/TilesetDocument.md)) or define them in
code.

```ts
localStorage.setItem("map", JSON.stringify(document.save()));
```

## Loading

Fetch the snapshot's atlases, then load it through the view:

```ts
const snapshot = parseVoxelWorld(
  JSON.parse(localStorage.getItem("map")!)
);

const document = new VoxelDocument({ chunkSize: snapshot.chunkSize });
const view = new VoxelView(document, {
  tilesets: await loadTilesets(snapshot.tilesets)
});

view.load(snapshot);
```

Passing `snapshot.chunkSize` keeps the saved chunk layout; another chunk size
works too and re-partitions the voxels. `parseVoxelWorld()` validates an
unknown value and throws `InvalidVoxelWorldError` on a malformed one.

When the view already exists, fetch only the atlases it lacks and pass them to
`load()`:

```ts
const missing = snapshot.tilesets.filter(
  (definition) => !view.atlases.get(definition.id)
);

view.load(snapshot, {
  tilesets: await loadTilesets(missing)
});
```

A tileset the snapshot declares without an atlas logs a warning, and its faces
stay hidden until `view.loadTileset()` registers it.

`load()` leaves the block registry alone. Define or project the blocks the
voxels use; a voxel whose block is unknown is not drawn until its definition
arrives.

Use `encodeVoxelWorld()` and `decodeVoxelWorld()` when storage or the network
works with bytes. See the
[serialization reference](../api/serialization/serialization.md) for the
format and its errors.
