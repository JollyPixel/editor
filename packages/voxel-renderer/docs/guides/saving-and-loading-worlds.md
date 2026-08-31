# Saving and loading worlds

`VoxelEngine.save()` returns plain JSON containing layers, objects, tileset
definitions, and registered blocks.

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

Every referenced tileset must be registered by the time `load()` applies the
document. Embedded block definitions are registered only when the same ID is
not already present, so local definitions win.

Use `parseVoxelDocument()` before treating an unknown JavaScript value as a
voxel document. Use `encodeVoxelDocument()` and `decodeVoxelDocument()` when a
storage or network boundary works with bytes.

The [serialization reference](../api/serialization/serialization.md) documents
the JSON schema, validation, and codec errors.
