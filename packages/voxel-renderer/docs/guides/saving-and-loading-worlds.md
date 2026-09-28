# Saving and loading worlds

`VoxelDocument.save()` returns plain JSON containing layers, objects and the
linked tileset definitions. Blocks are not part of it: a world only stores
the ids its tilesets project, so save the block definitions with the tileset
they belong to (see [`TilesetDocument`](../api/tilesets/TilesetDocument.md))
or define them in code.

```ts
const snapshot = sourceDocument.save();

localStorage.setItem(
  "map",
  JSON.stringify(snapshot)
);
```

Load the snapshot's textures before restoring it:

```ts
const snapshot = JSON.parse(
  localStorage.getItem("map")!
) as VoxelWorldJSON;

const document = new VoxelDocument({
  chunkSize: snapshot.chunkSize
});
const view = new VoxelView(document, {
  tilesets: await loadTilesets(snapshot.tilesets)
});

view.load(snapshot);
```

Passing `snapshot.chunkSize` keeps the saved chunk layout. A document with
another chunk size loads the snapshot too, and re-partitions its voxels.

Every referenced tileset must be registered by the time `load()` applies the
snapshot. The load leaves the block registry alone, so define or project the
blocks the voxels reference before rendering; a voxel whose block is unknown
is skipped until its definition arrives.

Use `parseVoxelWorld()` before treating an unknown JavaScript value as a
saved world. Use `encodeVoxelWorld()` and `decodeVoxelWorld()` when a
storage or network boundary works with bytes.

The [serialization reference](../api/serialization/serialization.md) documents
the JSON schema, validation, and codec errors.
