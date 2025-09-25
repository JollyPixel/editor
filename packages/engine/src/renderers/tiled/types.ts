/* eslint-disable no-inline-comments */
/* eslint-disable @stylistic/line-comment-position */
/**
 * TypeScript interfaces for the Tiled JSON Map Format.
 *
 * Source: Tiled docs “JSON Map Format” (1.11.x)
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

// ————————————————————————————————————————————————————————————————————————————
// # Property / Custom property system
// ————————————————————————————————————————————————————————————————————————————

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
  /** Property type */
  type?: TiledPropertyType; // default is "string"
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
  | (TiledPropertyBase & { type: "color"; value: string; }) // "#RRGGBB" or "#AARRGGBB"
  | (TiledPropertyBase & { type: "file"; value: string; }) // path/URL
  | (TiledPropertyBase & { type: "object"; value: number; }) // object id
  | (TiledPropertyBase & { type: "class"; value: Record<string, unknown>; });

// Helper alias: common field on many structures
export type TiledProperties = TiledProperty[];

// ————————————————————————————————————————————————————————————————————————————
// # Map
// ————————————————————————————————————————————————————————————————————————————

export interface TiledMap {
  type?: "map"; // since 1.0
  version: string; // JSON format version (since 1.6 saved as string)
  tiledversion?: string; // Tiled editor version used to save the file

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
  renderorder?: "right-down" | "right-up" | "left-down" | "left-up"; // orthogonal only

  /** Hex / stagger specifics */
  hexsidelength?: number; // hex maps only
  staggeraxis?: "x" | "y"; // staggered/hex only
  staggerindex?: "odd" | "even"; // staggered/hex only

  /** Parallax origin (since 1.8) */
  parallaxoriginx?: number;
  parallaxoriginy?: number;

  /** Global counters */
  nextlayerid: number;
  nextobjectid: number;

  /** Visuals */
  backgroundcolor?: string; // #RRGGBB or #AARRGGBB

  /** Compression level used for tile layer data (defaults -1 = algorithm default) */
  compressionlevel?: number;

  /** Optional class of the map (since 1.9) */
  class?: string;

  /** Composed content */
  layers: TiledAnyLayer[];
  tilesets: TiledMapTileset[]; // array of Tilesets with firstgid

  /** Custom properties */
  properties?: TiledProperties;
}

// ————————————————————————————————————————————————————————————————————————————
// # Layers (discriminated union by `type`)
// ————————————————————————————————————————————————————————————————————————————

interface TiledLayerBase {
  id: number; // unique across all layers
  name: string;
  opacity: number; // 0..1
  visible: boolean;
  x: number; // always 0 in tiles
  y: number; // always 0 in tiles
  offsetx?: number; // in pixels
  offsety?: number; // in pixels

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
  encoding?: "csv" | "base64"; // for tilelayer only
  compression?: "zlib" | "gzip" | "zstd" | ""; // empty means none
  height: number; // rows (same as map for fixed-size)
  width: number; // cols (same as map for fixed-size)
  /** Present on infinite maps */
  chunks?: TiledChunk[];
}

export interface TiledObjectLayer extends TiledLayerBase {
  type: "objectgroup";
  draworder?: "topdown" | "index"; // default topdown
  objects: TiledObject[];
  /** For fixed-size maps, height/width are 0 in examples */
  height?: number;
  width?: number;
}

export interface TiledImageLayer extends TiledLayerBase {
  type: "imagelayer";
  image?: string; // Image used by this layer
  transparentcolor?: string; // #RRGGBB
  repeatx?: boolean; // since 1.8
  repeaty?: boolean; // since 1.8
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

// ————————————————————————————————————————————————————————————————————————————
// # Chunks (infinite maps tilelayer data blocks)
// ————————————————————————————————————————————————————————————————————————————

export interface TiledChunk {
  data: number[] | string; // GIDs or base64-encoded
  height: number; // in tiles
  width: number; // in tiles
  x: number; // tile coords
  y: number; // tile coords
}

// ————————————————————————————————————————————————————————————————————————————
// # Objects & Text
// ————————————————————————————————————————————————————————————————————————————

export interface TiledObject {
  id: number; // unique across all objects
  name: string;
  type?: string; // class of the object (1.10 uses `type` again)
  visible: boolean;
  rotation: number; // degrees clockwise
  x: number; // pixels
  y: number; // pixels
  width: number; // pixels
  height: number; // pixels

  // object kind flags / payloads
  gid?: number; // when object represents a tile
  ellipse?: boolean; // mark object as ellipse
  point?: boolean; // mark object as point
  polygon?: TiledPoint[]; // when polygon
  polyline?: TiledPoint[]; // when polyline
  text?: TiledText; // for text objects

  // template reference (if instance of a template)
  template?: string;

  // custom data
  properties?: TiledProperties;
}

export interface TiledText {
  text: string;
  bold?: boolean; // default false
  italic?: boolean; // default false
  underline?: boolean; // default false
  strikeout?: boolean; // default false
  kerning?: boolean; // default true
  wrap?: boolean; // default false
  color?: string; // #RRGGBB or #AARRGGBB (default #000000)
  fontfamily?: string; // default "sans-serif"
  pixelsize?: number; // default 16
  halign?: "center" | "right" | "justify" | "left"; // default left
  valign?: "center" | "bottom" | "top"; // default top
}

export interface TiledPoint {
  x: number; // pixels (relative to object position)
  y: number; // pixels (relative to object position)
}

// ————————————————————————————————————————————————————————————————————————————
// # Tileset & related
// ————————————————————————————————————————————————————————————————————————————

/** Tileset as embedded in a map (with firstgid) */
export interface TiledMapTileset extends TiledTilesetCommon {
  /** Global ID of the first tile in the set */
  firstgid: number; // first tileset firstgid is 1
  /** If this is an external TSX/JSON tileset reference */
  source?: string;
}

/** Tileset file (when exported/embedded without firstgid) */
export interface TiledTileset extends TiledTilesetCommon {
  type?: "tileset"; // since 1.0 for tileset files
  version: string; // JSON format version (since 1.6 as string)
}

export interface TiledTilesetCommon {
  name: string;
  tilewidth: number;
  tileheight: number;
  tilecount: number;
  columns: number;

  /** Optional class (since 1.9) */
  class?: string;

  image?: string; // used for tiles in this set
  imagewidth?: number;
  imageheight?: number;
  margin?: number; // px
  spacing?: number; // px
  transparentcolor?: string; // #RRGGBB

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
  grid?: TiledGrid; // optional
  tileoffset?: TiledTileOffset; // optional
  transformations?: TiledTransformations; // optional

  /** Terrain & Wang */
  terrains?: TiledTerrain[]; // optional (deprecated by Wang sets)
  wangsets?: TiledWangSet[]; // since 1.1.5

  /** Editor version used to save */
  tiledversion?: string;

  /** Custom properties */
  properties?: TiledProperties;
}

export interface TiledGrid {
  height: number; // cell height
  width: number; // cell width
  orientation: "orthogonal" | "isometric"; // default orthogonal
}

export interface TiledTileOffset {
  x: number; // horizontal px offset
  y: number; // vertical px offset (positive is down)
}

export interface TiledTransformations {
  hflip: boolean;
  vflip: boolean;
  rotate: boolean;
  /** Whether untransformed tiles remain preferred */
  preferuntransformed: boolean;
}

export interface TiledTile {
  id: number; // local id within the tileset
  type?: string; // class of tile (1.10 uses `type` again)
  image?: string; // for image collection tilesets
  imagewidth?: number;
  imageheight?: number;
  /** sub-rectangle within the tileset image (since 1.9) */
  x?: number;
  y?: number;
  width?: number;
  height?: number;

  /** Collision/object shapes for this tile (optional) */
  objectgroup?: TiledObjectLayer; // layer with type objectgroup

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
  duration: number; // ms
  tileid: number; // local tile id
}

export interface TiledTerrain {
  name: string;
  tile: number; // local tile id
  properties?: TiledProperties;
}

export interface TiledWangSet {
  name: string;
  type: "corner" | "edge" | "mixed"; // since 1.5
  tile: number; // local tile id representing the set
  colors: TiledWangColor[]; // since 1.5
  properties?: TiledProperties;
  /** Optional class (since 1.9) */
  class?: string;
  /** Wang tiles entries */
  wangtiles?: TiledWangTile[];
}

export interface TiledWangColor {
  name: string;
  color: string; // #RRGGBB or #AARRGGBB
  tile: number; // local tile id representing the color
  probability: number;
  properties?: TiledProperties; // since 1.5
  /** Optional class (since 1.9) */
  class?: string;
}

export interface TiledWangTile {
  tileid: number; // local tile id
  /** Array of Wang color indexes (uchar[8]) */
  wangid: number[]; // length 8 expected
}

// ————————————————————————————————————————————————————————————————————————————
// # Object Template (external .tx / JSON template files)
// ————————————————————————————————————————————————————————————————————————————

export interface TiledObjectTemplate {
  type: "template";
  object: TiledObject;
  tileset?: TiledTileset | TiledMapTileset; // external tileset used by the template (optional)
}

// ————————————————————————————————————————————————————————————————————————————
// # Utility type: GID reference & helpers
// ————————————————————————————————————————————————————————————————————————————

/** Global Tile ID type alias (unsigned int in JSON) */
export type TiledGID = number;

/** A tile layer data cell is a GID or 0 (empty). */
export type TiledCell = TiledGID; // 0 means empty
