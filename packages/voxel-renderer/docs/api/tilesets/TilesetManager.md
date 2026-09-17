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
  dispose(): void;
}
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

`version` increases when atlases or the list change, so cached UV data can be
invalidated. `dispose()` disposes every texture and clears the list.

```ts
engine.tilesets.add(definition);
engine.tilesetManager.registerTexture(definition.id, texture);

const uv = engine.tilesetManager.get(definition.id)?.uvFor(0, 0);
```
