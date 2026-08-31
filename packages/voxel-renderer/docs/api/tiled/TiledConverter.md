# TiledConverter

`TiledConverter` converts a Tiled JSON map into `VoxelWorldJSON`.

- Tile layers become voxel layers.
- Object layers become voxel object layers.
- Group layers are flattened recursively.

Generated block definitions are embedded in the result so `VoxelEngine.load()`
can register them.

## API

```ts
interface TiledConverterOptions {
  resolveTilesetSrc: (
    tiledSource: string,
    tilesetId: string
  ) => string;
  chunkSize?: number;
  layerMode?: "flat" | "stacked";
  defaultShapeId?: BlockShapeID;
  collidable?: boolean;
}

class TiledConverter {
  convert(
    map: TiledMap,
    options: TiledConverterOptions
  ): VoxelWorldJSON;
}
```

`chunkSize` defaults to `16`. `layerMode` defaults to `"flat"`, which writes
every tile layer at y = 0. In `"stacked"` mode, each tile layer uses its flattened
layer index as y. Generated blocks default to the `"cube"` shape and are
collidable unless configured otherwise.

`resolveTilesetSrc()` maps a Tiled `.tsx` source and derived tileset ID to the
image URL stored in `TilesetDefinition.src`. Embedded tilesets pass an empty
source string.

Infinite maps and compressed tile data are not supported. The converter throws
when it encounters either form.

## Tiled JSON types

The plugin exports the JSON declarations used by `TiledConverter`. Field names
match Tiled 1.11.x JSON so a parsed `.tmj` value can be typed without an adapter.

`TiledMap` is the root document. Its `layers` field contains `TiledAnyLayer`:

```ts
type TiledAnyLayer =
  | TiledTileLayer
  | TiledObjectLayer
  | TiledImageLayer
  | TiledGroupLayer;
```

`TiledTileLayer` stores GID cells or encoded data. `TiledObjectLayer` stores
`TiledObject` values. `TiledImageLayer` refers to a standalone image, while
`TiledGroupLayer` recursively contains more layers. `TiledChunk` represents
chunk data from an infinite map; the converter rejects that form.

`TiledGID` is a numeric global tile ID. `TiledCell` is an alias for a GID or the
empty value `0` used in layer data.

### Objects and properties

`TiledObject` may contain a polygon or polyline of `TiledPoint` values, a
`TiledText` value, a tile GID, or primitive geometry. `TiledObjectTemplate`
represents a separate template document.

Custom properties use these exports:

```ts
interface TiledPropertyBase {
  name: string;
  type?: TiledPropertyType;
  propertytype?: string;
}

type TiledPropertyType =
  | "string"
  | "int"
  | "float"
  | "bool"
  | "color"
  | "file"
  | "object"
  | "class";

type TiledProperties = TiledProperty[];
```

`TiledProperty` is a discriminated union that pairs each property type with its
value type.

### Tilesets

`TiledMapTileset` is a map-level tileset entry and may point to an external
source. `TiledTileset` is the root of a standalone tileset document. Both extend
`TiledTilesetCommon`.

The tileset declarations also export:

- `TiledTile`, `TiledFrame`, `TiledGrid`, and `TiledTileOffset`.
- `TiledTransformations` and `TiledTerrain`.
- `TiledWangSet`, `TiledWangColor`, and `TiledWangTile`.

Import all of these types from
`@jolly-pixel/voxel.renderer/plugins/tiled/index.js`.

See [importing a Tiled map](../../guides/importing-a-tiled-map.md) for direct and
asset-backed loading examples.
