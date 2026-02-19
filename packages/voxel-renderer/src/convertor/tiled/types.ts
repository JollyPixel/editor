/**
 * TypeScript interfaces for the Tiled JSON Map Format.
 *
 * Source: Tiled docs "JSON Map Format" (1.11.x)
 * - Map, Layer, Chunk, Object, Text, Tileset (+ Grid, TileOffset, Transformations),
 *   Tile, Frame, Terrain, WangSet (+ WangColor, WangTile), Object Template, Property, Point.
 *
 * Notes:
 * - Field names mirror the JSON schema from Tiled (snake/lower camel as-is).
 * - Optional fields are marked with `?` exactly as per the documentation.
 * - Some fields are present only on certain layer/element kinds (discriminated unions below).
 * - For compatibility with Tiled 1.9+: several elements have a `class` string (optional).
 * - Since Tiled 1.10: `type` on tile/object (formerly `class` in 1.9) is used again in JSON exports.
 */

/**
 * A custom property entry.
 *
 * Doc excerpt:
 * - name: string
 * - type: "string" | "int" | "float" | "bool" | "color" | "file" | "object" | "class"
 * - propertytype: string (name of the custom property type) (since 1.8)
 * - value: depends on type (arbitrary object when type === "class")
 */
export interface TiledPropertyBase {
  name: string;
  /** Property type. Default: "string". */
  type?: TiledPropertyType;
  /** Name of the custom property type (since 1.8), when applicable */
  propertytype?: string;
}

export type TiledPropertyType =
  | "string"
  | "int"
  | "float"
  | "bool"
  | "color"
  | "file"
  | "object"
  | "class";

export type TiledProperty =
  | (TiledPropertyBase & { type?: "string"; value: string; })
  | (TiledPropertyBase & { type: "int"; value: number; })
  | (TiledPropertyBase & { type: "float"; value: number; })
  | (TiledPropertyBase & { type: "bool"; value: boolean; })
  // value format: "#RRGGBB" or "#AARRGGBB"
  | (TiledPropertyBase & { type: "color"; value: string; })
  // value is a path/URL string
  | (TiledPropertyBase & { type: "file"; value: string; })
  // value is the referenced object id
  | (TiledPropertyBase & { type: "object"; value: number; })
  | (TiledPropertyBase & { type: "class"; value: Record<string, unknown>; });

// Helper alias: common field on many structures
export type TiledProperties = TiledProperty[];

export interface TiledMap {
  // since 1.0
  type?: "map";
  // JSON format version (since 1.6 saved as string)
  version: string;
  // Tiled editor version used to save the file
  tiledversion?: string;

  /** Number of tile columns / rows */
  width: number;
  height: number;

  /** Map grid tile size */
  tilewidth: number;
  tileheight: number;

  /** Whether the map has infinite dimensions */
  infinite: boolean;

  /** Orientation and render order */
  orientation: "orthogonal" | "isometric" | "staggered" | "hexagonal";
  // orthogonal only
  renderorder?: "right-down" | "right-up" | "left-down" | "left-up";

  /** Hex / stagger specifics */
  // hex maps only
  hexsidelength?: number;
  // staggered/hex only
  staggeraxis?: "x" | "y";
  // staggered/hex only
  staggerindex?: "odd" | "even";

  /** Parallax origin (since 1.8) */
  parallaxoriginx?: number;
  parallaxoriginy?: number;

  /** Global counters */
  nextlayerid: number;
  nextobjectid: number;

  /** Visuals */
  // #RRGGBB or #AARRGGBB
  backgroundcolor?: string;

  /** Compression level used for tile layer data (defaults -1 = algorithm default) */
  compressionlevel?: number;

  /** Optional class of the map (since 1.9) */
  class?: string;

  /** Composed content */
  layers: TiledAnyLayer[];
  // array of Tilesets with firstgid
  tilesets: TiledMapTileset[];

  /** Custom properties */
  properties?: TiledProperties;
}

interface TiledLayerBase {
  // unique across all layers
  id: number;
  name: string;
  // 0..1
  opacity: number;
  visible: boolean;
  // always 0 in tiles
  x: number;
  // always 0 in tiles
  y: number;
  // in pixels
  offsetx?: number;
  // in pixels
  offsety?: number;

  /** Parallax factors (since 1.5) */
  parallaxx?: number;
  parallaxy?: number;

  /** Tint color multiplied with drawn graphics (#RRGGBB or #AARRGGBB) */
  tintcolor?: string;

  /** Optional class (since 1.9) */
  class?: string;

  /** Custom properties */
  properties?: TiledProperties;

  /** Infinite maps only */
  startx?: number;
  starty?: number;
}

export interface TiledTileLayer extends TiledLayerBase {
  type: "tilelayer";
  /** Data can be an array of unsigned ints (GIDs) or base64-encoded string */
  data: number[] | string;
  // for tilelayer only
  encoding?: "csv" | "base64";
  // empty string means no compression
  compression?: "zlib" | "gzip" | "zstd" | "";
  // rows (same as map for fixed-size)
  height: number;
  // cols (same as map for fixed-size)
  width: number;
  /** Present on infinite maps */
  chunks?: TiledChunk[];
}

export interface TiledObjectLayer extends TiledLayerBase {
  type: "objectgroup";
  // default topdown
  draworder?: "topdown" | "index";
  objects: TiledObject[];
  /** For fixed-size maps, height/width are 0 in examples */
  height?: number;
  width?: number;
}

export interface TiledImageLayer extends TiledLayerBase {
  type: "imagelayer";
  // Image used by this layer
  image?: string;
  // #RRGGBB
  transparentcolor?: string;
  // since 1.8
  repeatx?: boolean;
  // since 1.8
  repeaty?: boolean;
  /** since 1.11.1 */
  imageheight?: number;
  imagewidth?: number;
  /** For fixed-size maps, height/width are not stored; keep optional */
  height?: number;
  width?: number;
}

export interface TiledGroupLayer extends TiledLayerBase {
  type: "group";
  layers: TiledAnyLayer[];
}

export type TiledAnyLayer =
  | TiledTileLayer
  | TiledObjectLayer
  | TiledImageLayer
  | TiledGroupLayer;

export interface TiledChunk {
  // GIDs or base64-encoded
  data: number[] | string;
  // in tiles
  height: number;
  // in tiles
  width: number;
  // tile coords
  x: number;
  // tile coords
  y: number;
}

export interface TiledObject {
  // unique across all objects
  id: number;
  name: string;
  // class of the object (1.10 uses `type` again)
  type?: string;
  visible: boolean;
  // degrees clockwise
  rotation: number;
  // pixels
  x: number;
  // pixels
  y: number;
  // pixels
  width: number;
  // pixels
  height: number;

  // object kind flags / payloads
  // when object represents a tile
  gid?: number;
  // mark object as ellipse
  ellipse?: boolean;
  // mark object as point
  point?: boolean;
  // when polygon
  polygon?: TiledPoint[];
  // when polyline
  polyline?: TiledPoint[];
  // for text objects
  text?: TiledText;

  // template reference (if instance of a template)
  template?: string;

  // custom data
  properties?: TiledProperties;
}

export interface TiledText {
  text: string;
  // default false
  bold?: boolean;
  // default false
  italic?: boolean;
  // default false
  underline?: boolean;
  // default false
  strikeout?: boolean;
  // default true
  kerning?: boolean;
  // default false
  wrap?: boolean;
  // #RRGGBB or #AARRGGBB (default #000000)
  color?: string;
  // default "sans-serif"
  fontfamily?: string;
  // default 16
  pixelsize?: number;
  // default left
  halign?: "center" | "right" | "justify" | "left";
  // default top
  valign?: "center" | "bottom" | "top";
}

export interface TiledPoint {
  // pixels (relative to object position)
  x: number;
  // pixels (relative to object position)
  y: number;
}

/** Tileset as embedded in a map (with firstgid) */
export interface TiledMapTileset extends TiledTilesetCommon {
  /** Global ID of the first tile in the set */
  // first tileset firstgid is 1
  firstgid: number;
  /** If this is an external TSX/JSON tileset reference */
  source?: string;
}

/** Tileset file (when exported/embedded without firstgid) */
export interface TiledTileset extends TiledTilesetCommon {
  // since 1.0 for tileset files
  type?: "tileset";
  // JSON format version (since 1.6 as string)
  version: string;
}

export interface TiledTilesetCommon {
  name: string;
  tilewidth: number;
  tileheight: number;
  tilecount: number;
  columns: number;

  /** Optional class (since 1.9) */
  class?: string;

  // used for tiles in this set
  image?: string;
  imagewidth?: number;
  imageheight?: number;
  // px
  margin?: number;
  // px
  spacing?: number;
  // #RRGGBB
  transparentcolor?: string;

  /** Rendering options (since 1.9) */
  tilerendersize?: "tile" | "grid";
  fillmode?: "stretch" | "preserve-aspect-fit";

  /** Alignment of tile objects (since 1.4) */
  objectalignment?:
    | "unspecified"
    | "topleft"
    | "top"
    | "topright"
    | "left"
    | "center"
    | "right"
    | "bottomleft"
    | "bottom"
    | "bottomright";

  /** Embedded tile definitions */
  tiles?: TiledTile[];

  /** Collisions & grid */
  // optional
  grid?: TiledGrid;
  // optional
  tileoffset?: TiledTileOffset;
  // optional
  transformations?: TiledTransformations;

  /** Terrain & Wang */
  // optional (deprecated by Wang sets)
  terrains?: TiledTerrain[];
  // since 1.1.5
  wangsets?: TiledWangSet[];

  /** Editor version used to save */
  tiledversion?: string;

  /** Custom properties */
  properties?: TiledProperties;
}

export interface TiledGrid {
  // cell height
  height: number;
  // cell width
  width: number;
  // default orthogonal
  orientation: "orthogonal" | "isometric";
}

export interface TiledTileOffset {
  // horizontal px offset
  x: number;
  // vertical px offset (positive is down)
  y: number;
}

export interface TiledTransformations {
  hflip: boolean;
  vflip: boolean;
  rotate: boolean;
  /** Whether untransformed tiles remain preferred */
  preferuntransformed: boolean;
}

export interface TiledTile {
  // local id within the tileset
  id: number;
  // class of tile (1.10 uses `type` again)
  type?: string;
  // for image collection tilesets
  image?: string;
  imagewidth?: number;
  imageheight?: number;
  /** sub-rectangle within the tileset image (since 1.9) */
  x?: number;
  y?: number;
  width?: number;
  height?: number;

  /** Collision/object shapes for this tile (optional) */
  // layer with type objectgroup
  objectgroup?: TiledObjectLayer;

  /** Probability weight (editor) */
  probability?: number;

  /** Custom data */
  properties?: TiledProperties;

  /** Legacy terrain info (replaced by Wang sets since 1.5) */
  terrain?: [number, number, number, number];

  /** Animation frames for animated tiles */
  animation?: TiledFrame[];
}

export interface TiledFrame {
  // ms
  duration: number;
  // local tile id
  tileid: number;
}

export interface TiledTerrain {
  name: string;
  // local tile id
  tile: number;
  properties?: TiledProperties;
}

export interface TiledWangSet {
  name: string;
  // since 1.5
  type: "corner" | "edge" | "mixed";
  // local tile id representing the set
  tile: number;
  // since 1.5
  colors: TiledWangColor[];
  properties?: TiledProperties;
  /** Optional class (since 1.9) */
  class?: string;
  /** Wang tiles entries */
  wangtiles?: TiledWangTile[];
}

export interface TiledWangColor {
  name: string;
  // #RRGGBB or #AARRGGBB
  color: string;
  // local tile id representing the color
  tile: number;
  probability: number;
  // since 1.5
  properties?: TiledProperties;
  /** Optional class (since 1.9) */
  class?: string;
}

export interface TiledWangTile {
  // local tile id
  tileid: number;
  /** Array of Wang color indexes (uchar[8]) */
  // length 8 expected
  wangid: number[];
}

export interface TiledObjectTemplate {
  type: "template";
  object: TiledObject;
  // external tileset used by the template (optional)
  tileset?: TiledTileset | TiledMapTileset;
}

/** Global Tile ID type alias (unsigned int in JSON) */
export type TiledGID = number;

/** A tile layer data cell is a GID or 0 (empty). */
// 0 means empty
export type TiledCell = TiledGID;
