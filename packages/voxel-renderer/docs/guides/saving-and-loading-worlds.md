# Saving and loading worlds

`VoxelEngine.save()` returns plain JSON containing layers, objects and the
linked tileset definitions. Blocks are not part of it: a world only stores
the ids its tilesets project, so save the block definitions with the tileset
they belong to (see [`TilesetDocument`](../api/tilesets/TilesetDocument.md))
or define them in code.

```ts
const document = sourceEngine.save();

localStorage.setItem(
  "map",
  JSON.stringify(document)
);
```

Load the document's textures before restoring it:

```ts
const document = JSON.parse(
  localStorage.getItem("map")!
) as VoxelWorldJSON;

const engine = new VoxelEngine({
  chunkSize: document.chunkSize,
  tilesets: await loadTilesets(document.tilesets)
});

engine.load(document);
```

Passing `document.chunkSize` keeps the saved chunk layout. An engine with
another chunk size loads the document too, and re-partitions its voxels.

Every referenced tileset must be registered by the time `load()` applies the
document. The load leaves the block registry alone, so define or project the
blocks the voxels reference before rendering; a voxel whose block is unknown
is skipped until its definition arrives.

Use `parseVoxelDocument()` before treating an unknown JavaScript value as a
voxel document. Use `encodeVoxelDocument()` and `decodeVoxelDocument()` when a
storage or network boundary works with bytes.

The [serialization reference](../api/serialization/serialization.md) documents
the JSON schema, validation, and codec errors.
