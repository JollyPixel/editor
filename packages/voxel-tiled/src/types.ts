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
  version: string;
  tiledversion?: string;

  width: number;
  height: number;

  tilewidth: number;
  tileheight: number;

  infinite: boolean;

  orientation: "orthogonal" | "isometric" | "staggered" | "hexagonal";
  renderorder?: "right-down" | "right-up" | "left-down" | "left-up";

  hexsidelength?: number;
  staggeraxis?: "x" | "y";
  staggerindex?: "odd" | "even";

  parallaxoriginx?: number;
  parallaxoriginy?: number;

  nextlayerid: number;
  nextobjectid: number;

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
  id: number;
  name: string;
  opacity: number;
  visible: boolean;
  x: number;
  y: number;
  offsetx?: number;
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
  encoding?: "csv" | "base64";
  compression?: "zlib" | "gzip" | "zstd" | "";
  height: number;
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
  transparentcolor?: string;
  repeatx?: boolean;
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
  data: number[] | string;
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface TiledObject {
  id: number;
  name: string;
  type?: string;
  visible: boolean;
  rotation: number;
  x: number;
  y: number;
  width: number;
  height: number;

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
  x: number;
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
  version: string;
}

export interface TiledTilesetCommon {
  name: string;
  tilewidth: number;
  tileheight: number;
  tilecount: number;
  columns: number;

  class?: string;

  image?: string;
  imagewidth?: number;
  imageheight?: number;
  margin?: number;
  spacing?: number;
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
  terrains?: TiledTerrain[];
  wangsets?: TiledWangSet[];

  tiledversion?: string;
  properties?: TiledProperties;
}

export interface TiledGrid {
  height: number;
  width: number;
  /**
   * @default "orthogonal"
   */
  orientation: "orthogonal" | "isometric";
}

export interface TiledTileOffset {
  x: number;
  y: number;
}

export interface TiledTransformations {
  hflip: boolean;
  vflip: boolean;
  rotate: boolean;
  preferuntransformed: boolean;
}

export interface TiledTile {
  id: number;
  type?: string;
  image?: string;
  imagewidth?: number;
  imageheight?: number;
  /** sub-rectangle within the tileset image (since 1.9) */
  x?: number;
  y?: number;
  width?: number;
  height?: number;

  /** Collision/object shapes for this tile (optional) */
  objectgroup?: TiledObjectLayer;

  probability?: number;

  properties?: TiledProperties;

  /** Legacy terrain info (replaced by Wang sets since 1.5) */
  terrain?: [number, number, number, number];

  animation?: TiledFrame[];
}

export interface TiledFrame {
  duration: number;
  tileid: number;
}

export interface TiledTerrain {
  name: string;
  tile: number;
  properties?: TiledProperties;
}

export interface TiledWangSet {
  name: string;
  type: "corner" | "edge" | "mixed";
  tile: number;
  colors: TiledWangColor[];
  properties?: TiledProperties;
  class?: string;
  wangtiles?: TiledWangTile[];
}

export interface TiledWangColor {
  name: string;
  color: string;
  tile: number;
  probability: number;
  properties?: TiledProperties;
  class?: string;
}

export interface TiledWangTile {
  tileid: number;
  /** Array of Wang color indexes (uchar[8]) */
  wangid: number[];
}

export interface TiledObjectTemplate {
  type: "template";
  object: TiledObject;
  tileset?: TiledTileset | TiledMapTileset;
}

export type TiledGID = number;

/** A tile layer data cell is a GID or 0 (empty). */
export type TiledCell = TiledGID;
