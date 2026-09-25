# TilesetManager

Atlases built from the declared tilesets and their loaded textures.
`VoxelEngine.tilesetManager` exposes the one the engine uses.

```ts
interface TilesetManagerOptions {
  tilesets?: TilesetList;
}

class TilesetManager {
  readonly tilesets: TilesetList;
  readonly defaultTilesetId: string | null;
  readonly version: number;

  constructor(options?: TilesetManagerOptions);
  registerTexture(tilesetId: string, texture: TilesetTexture): TilesetAtlas;
  syncAtlases(): string[];
  get(tilesetId?: string): TilesetAtlas | undefined;
  atlas(tilesetId?: string): TilesetAtlas;
  resolve(tilesetId?: string): TilesetAtlas | MissingTilesetAtlas | undefined;
  refreshAverages(): void;
  dispose(): void;
}

const MISSING_TILESET_ID = "$missing";
type MissingTilesetAtlas = TilesetAtlas<THREE.DataTexture>;
```

`tilesets` is the [`TilesetList`](./tilesets.md#tilesetlist) of declared
tilesets, created empty unless one is passed. The manager reads it and never
changes it, except in `dispose()`. A declared tileset may have no atlas yet.
`defaultTilesetId` is the first declared ID, used by references without a
`tilesetId`.

`registerTexture()` builds the atlas of a declared tileset from its declared
definition. It throws when the ID is not declared: declare it first with
`tilesets.add()`, or use
[`VoxelEngine.loadTileset()`](../core/VoxelEngine.md), which does both.
Registering an ID that already has an atlas replaces it and disposes the
previous texture when it differs.

`syncAtlases()` realigns atlases after the list changed. It drops and disposes
the atlas of an undeclared tileset, and rebuilds on the same texture the atlas
of a tileset whose `tileSize` changed. It returns the affected IDs.

`get()` returns the atlas of the given ID, or of the default tileset when the
ID is omitted, and `undefined` when that tileset has no atlas. `atlas()` does
the same lookup and throws instead.

`refreshAverages()` rebuilds the average table of every atlas whose texture
changed since it was built (see
[distant tiles](../../concepts/rendering-and-meshing.md#distant-tiles)).
`VoxelView.tick()` calls it, so an edit pushed through
`TilesetAtlas.updateImage()` reaches distant faces on the next tick.

`version` increases when atlases or the list change, so cached UV data can be
invalidated. `dispose()` disposes every texture and leaves the list, which
belongs to the document.

## Missing tileset

`resolve()` is the lookup the mesher and the chunk materials use. It returns
the atlas like `get()`, `undefined` while a declared tileset has no texture,
and the missing-tileset atlas when the ID is not declared (a removed tileset,
or no tileset at all).

The missing-tileset atlas is a generated 16x16 single-tile texture, red with a
white cross. It is created on first use, shared, and disposed by `dispose()`.
Its faces are meshed under `MISSING_TILESET_ID`, which is also the `tilesetId`
a `materialCustomizer` receives for them. The ID is reserved:
`TilesetList.add()` refuses it, so it is never declared or serialized.

```ts
engine.tilesets.add(definition);
engine.tilesetManager.registerTexture(definition.id, texture);

const uv = engine.tilesetManager.get(definition.id)?.uvFor(0, 0);
```
