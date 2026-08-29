/**
 * Tiled 1.11 JSON types with field names matching the upstream schema.
 */

/**
 * Base fields shared by every Tiled custom property variant.
 */
export interface TiledPropertyBase {
  name: string;
  /**
   * Property type.
   * @default "string"
   */
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
  | (TiledPropertyBase & { type: "color"; value: string; })
  | (TiledPropertyBase & { type: "file"; value: string; })
  | (TiledPropertyBase & { type: "object"; value: number; })
  | (TiledPropertyBase & { type: "class"; value: Record<string, unknown>; });

export type TiledProperties = TiledProperty[];

export interface TiledMap {
  type?: "map";
  // JSON format version (since 1.6 saved as string)
  version: string;
  tiledversion?: string;

  width: number;
  height: number;

  tilewidth: number;
  tileheight: number;

  infinite: boolean;

  orientation: "orthogonal" | "isometric" | "staggered" | "hexagonal";
  // orthogonal only
  renderorder?: "right-down" | "right-up" | "left-down" | "left-up";

  // hex maps only
  hexsidelength?: number;
  // staggered/hex only
  staggeraxis?: "x" | "y";
  // staggered/hex only
  staggerindex?: "odd" | "even";

  parallaxoriginx?: number;
  parallaxoriginy?: number;

  nextlayerid: number;
  nextobjectid: number;

  // #RRGGBB or #AARRGGBB
  backgroundcolor?: string;

  /**
   * @default -1
   */
  compressionlevel?: number;

  class?: string;

  layers: TiledAnyLayer[];
  tilesets: TiledMapTileset[];
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

  parallaxx?: number;
  parallaxy?: number;

  /** Tint color multiplied with drawn graphics (#RRGGBB or #AARRGGBB) */
  tintcolor?: string;

  class?: string;

  properties?: TiledProperties;

  startx?: number;
  starty?: number;
}

export interface TiledTileLayer extends TiledLayerBase {
  type: "tilelayer";
  data: number[] | string;
  // for tilelayer only
  encoding?: "csv" | "base64";
  // empty string means no compression
  compression?: "zlib" | "gzip" | "zstd" | "";
  // rows (same as map for fixed-size)
  height: number;
  // cols (same as map for fixed-size)
  width: number;
  chunks?: TiledChunk[];
}

export interface TiledObjectLayer extends TiledLayerBase {
  type: "objectgroup";
  /**
   * @default "topdown"
   */
  draworder?: "topdown" | "index";
  objects: TiledObject[];
  /** For fixed-size maps, height/width are 0 in examples */
  height?: number;
  width?: number;
}

export interface TiledImageLayer extends TiledLayerBase {
  type: "imagelayer";
  image?: string;
  // #RRGGBB
  transparentcolor?: string;
  // since 1.8
  repeatx?: boolean;
  // since 1.8
  repeaty?: boolean;
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

  // when object represents a tile
  gid?: number;
  ellipse?: boolean;
  point?: boolean;
  polygon?: TiledPoint[];
  polyline?: TiledPoint[];
  text?: TiledText;
  template?: string;
  properties?: TiledProperties;
}

export interface TiledText {
  text: string;
  /**
   * @default false
   */
  bold?: boolean;
  /**
   * @default false
   */
  italic?: boolean;
  /**
   * @default false
   */
  underline?: boolean;
  /**
   * @default false
   */
  strikeout?: boolean;
  /**
   * @default true
   */
  kerning?: boolean;
  /**
   * @default false
   */
  wrap?: boolean;
  /**
   * @default "#000000"
   */
  color?: string;
  /**
   * @default "sans-serif"
   */
  fontfamily?: string;
  /**
   * @default 16
   */
  pixelsize?: number;
  /**
   * @default "left"
   */
  halign?: "center" | "right" | "justify" | "left";
  /**
   * @default "top"
   */
  valign?: "center" | "bottom" | "top";
}

export interface TiledPoint {
  // pixels (relative to object position)
  x: number;
  // pixels (relative to object position)
  y: number;
}

export interface TiledMapTileset extends TiledTilesetCommon {
  /**
   * @default 1 for the first tileset
   */
  firstgid: number;
  source?: string;
}

export interface TiledTileset extends TiledTilesetCommon {
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

  tilerendersize?: "tile" | "grid";
  fillmode?: "stretch" | "preserve-aspect-fit";

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

  tiles?: TiledTile[];
  grid?: TiledGrid;
  tileoffset?: TiledTileOffset;
  transformations?: TiledTransformations;
  // optional (deprecated by Wang sets)
  terrains?: TiledTerrain[];
  // since 1.1.5
  wangsets?: TiledWangSet[];

  tiledversion?: string;
  properties?: TiledProperties;
}

export interface TiledGrid {
  // cell height
  height: number;
  // cell width
  width: number;
  /**
   * @default "orthogonal"
   */
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

  probability?: number;

  properties?: TiledProperties;

  /** Legacy terrain info (replaced by Wang sets since 1.5) */
  terrain?: [number, number, number, number];

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
  class?: string;
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
  class?: string;
}

export interface TiledWangTile {
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

export type TiledGID = number;

/** A tile layer data cell is a GID or 0 (empty). */
export type TiledCell = TiledGID;
