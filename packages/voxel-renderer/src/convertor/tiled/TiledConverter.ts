// Import Internal Dependencies
import type {
  TiledMap,
  TiledAnyLayer,
  TiledTileLayer,
  TiledObjectLayer,
  TiledMapTileset,
  TiledProperty
} from "./types.ts";
import {
  TileSet,
  TILED_FLIPPED_FLAGS
} from "./TileSet.ts";

import type {
  VoxelWorldJSON,
  VoxelLayerJSON,
  VoxelEntryKey,
  VoxelObjectLayerJSON,
  VoxelObjectJSON,
  VoxelObjectProperties
} from "../../serialization/VoxelSerializer.ts";
import type { TilesetDefinition } from "../../tileset/types.ts";
import type { BlockDefinition } from "../../blocks/BlockDefinition.ts";
import type { BlockShapeID } from "../../blocks/BlockShape.ts";

export interface TiledConverterOptions {
  /**
   * Maps a Tiled tileset `source` string (e.g. `"TX Tileset Grass.tsx"`) and
   * its derived ID to the actual asset path/URL used for TilesetDefinition.src.
   * Called once per tileset. For embedded tilesets without a source file,
   * `tiledSource` is an empty string and `tilesetId` is the tileset name.
   */
  resolveTilesetSrc: (tiledSource: string, tilesetId: string) => string;

  /**
   * Chunk size written into the VoxelWorldJSON output.
   * @default 16
   */
  chunkSize?: number;

  /**
   * Controls how Tiled tile layers map to the 3-D Y axis.
   *
   * - `"flat"`    — all tile layers are placed at Y=0; when two layers occupy
   *                 the same (x, z) cell the later layer wins.
   * - `"stacked"` — tile layer at index N is placed at Y=N (useful for
   *                 multi-floor or multi-depth maps).
   *
   * @default "flat"
   */
  layerMode?: "flat" | "stacked";

  /**
   * BlockShape ID assigned to every generated block.
   * @default "fullCube"
   */
  defaultShapeId?: BlockShapeID;

  /**
   * Whether generated blocks are collidable.
   * @default true
   */
  collidable?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal context types (avoid exceeding max-params limit)
// ─────────────────────────────────────────────────────────────────────────────

interface TilesetBuildContext {
  options: TiledConverterOptions;
  tilesetIds: Map<number, string>;
}

interface BlockBuildContext {
  tileSets: TileSet[];
  tilesetIds: Map<number, string>;
  options: TiledConverterOptions;
}

interface TileLayerContext {
  gidToBlockId: Map<number, number>;
  map: TiledMap;
  options: TiledConverterOptions;
  counter: { value: number; };
}

interface ObjectLayerContext {
  map: TiledMap;
  counter: { value: number; };
}

/**
 * Converts a parsed Tiled JSON map to a VoxelWorldJSON snapshot.
 *
 * - Each Tiled tile layer becomes a VoxelLayerJSON.
 * - Each Tiled object layer becomes a VoxelObjectLayerJSON.
 * - One BlockDefinition is generated per unique tile GID found in the map;
 *   these are embedded in the output as `blocks` so the file is self-contained.
 *
 * No browser or Three.js dependency — safe to run in Node.js build pipelines.
 */
export class TiledConverter {
  convert(
    map: TiledMap,
    options: TiledConverterOptions
  ): VoxelWorldJSON {
    const tileSets: TileSet[] = [];
    for (const ts of map.tilesets) {
      if (!ts.tileheight) {
        ts.tileheight = map.tileheight;
      }
      if (!ts.tilewidth) {
        ts.tilewidth = map.tilewidth;
      }

      tileSets.push(new TileSet(ts));
    }

    const tilesetIds = new Map<number, string>();
    for (let i = 0; i < map.tilesets.length; i++) {
      tilesetIds.set(map.tilesets[i].firstgid, deriveTilesetId(map.tilesets[i], i));
    }

    const tilesetCtx: TilesetBuildContext = { options, tilesetIds };
    const tilesets = map.tilesets.map((ts, i) => buildTilesetDefinition(ts, i, tilesetCtx));

    const rawGids = new Set<number>();
    collectGIDs(map.layers, rawGids);

    const blockCtx: BlockBuildContext = { tileSets, tilesetIds, options };
    const { blocks, gidToBlockId } = buildBlocks(rawGids, blockCtx);

    const layers: VoxelLayerJSON[] = [];
    const tileLayerCtx: TileLayerContext = {
      gidToBlockId,
      map,
      options,
      counter: { value: 0 }
    };
    convertTileLayers(map.layers, layers, tileLayerCtx);

    const objectLayers: VoxelObjectLayerJSON[] = [];
    const objectLayerCtx: ObjectLayerContext = { map, counter: { value: 0 } };
    convertObjectLayers(map.layers, objectLayers, objectLayerCtx);

    const result: VoxelWorldJSON = {
      version: 1,
      chunkSize: options.chunkSize ?? 16,
      tilesets,
      blocks,
      layers
    };

    if (objectLayers.length > 0) {
      result.objectLayers = objectLayers;
    }

    return result;
  }
}

/**
 * Derives a stable string ID for a tileset.
 * Prefers the tileset name; falls back to the source filename without extension;
 * last resort is a positional placeholder.
 */
function deriveTilesetId(
  tileset: TiledMapTileset,
  index: number
): string {
  if (tileset.name) {
    return tileset.name;
  }
  if (tileset.source) {
    // Strip directory prefix by splitting on path separators, then strip extension.
    const filename = tileset.source.split(/[/\\]/).at(-1) ?? tileset.source;
    const dotIndex = filename.lastIndexOf(".");

    return dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  }

  return `tileset_${index}`;
}

function buildTilesetDefinition(
  ts: TiledMapTileset,
  index: number,
  ctx: TilesetBuildContext
): TilesetDefinition {
  const id = ctx.tilesetIds.get(ts.firstgid) ?? deriveTilesetId(ts, index);
  const src = ctx.options.resolveTilesetSrc(ts.source ?? "", id);

  return {
    id,
    src,
    tileSize: ts.tilewidth,
    cols: ts.columns,
    rows: ts.tilecount / ts.columns
  };
}

function collectGIDs(
  layers: TiledAnyLayer[],
  out: Set<number>
): void {
  for (const layer of layers) {
    if (layer.type === "tilelayer") {
      const data = decodeLayerData(layer);
      for (const gid of data) {
        if (gid !== 0) {
          out.add(gid & ~TILED_FLIPPED_FLAGS);
        }
      }
    }
    else if (layer.type === "group") {
      collectGIDs(layer.layers, out);
    }
  }
}

function buildBlocks(
  rawGids: Set<number>,
  ctx: BlockBuildContext
): { blocks: BlockDefinition[]; gidToBlockId: Map<number, number>; } {
  const blocks: BlockDefinition[] = [];
  const gidToBlockId = new Map<number, number>();
  let nextId = 1;

  for (const rawGid of rawGids) {
    const tileSet = TileSet.find(ctx.tileSets, rawGid);
    if (!tileSet) {
      continue;
    }

    const props = tileSet.getTileProperties(rawGid);
    if (!props) {
      continue;
    }

    const tilesetId = ctx.tilesetIds.get(tileSet.firstgid) ?? tileSet.name;
    const localId = tileSet.getTileLocalId(rawGid);
    const blockId = nextId++;

    gidToBlockId.set(rawGid, blockId);

    blocks.push({
      id: blockId,
      name: `${tilesetId}_${localId}`,
      shapeId: ctx.options.defaultShapeId ?? "cube",
      faceTextures: {},
      defaultTexture: {
        col: props.coords.x,
        row: props.coords.y,
        tilesetId
      },
      collidable: ctx.options.collidable ?? true
    });
  }

  return { blocks, gidToBlockId };
}

function convertTileLayers(
  layers: TiledAnyLayer[],
  out: VoxelLayerJSON[],
  ctx: TileLayerContext
): void {
  for (const layer of layers) {
    if (layer.type === "tilelayer") {
      out.push(convertTileLayer(layer, ctx, out.length));
      ctx.counter.value++;
    }
    else if (layer.type === "group") {
      convertTileLayers(layer.layers, out, ctx);
    }
  }
}

function convertTileLayer(
  layer: TiledTileLayer,
  ctx: TileLayerContext,
  layerOrder: number
): VoxelLayerJSON {
  const data = decodeLayerData(layer);
  const voxels: Record<VoxelEntryKey, { block: number; transform: number; }> = Object.create(null);

  const voxelY = ctx.options.layerMode === "stacked" ? ctx.counter.value : 0;
  const cols = layer.width ?? ctx.map.width;

  for (let i = 0; i < data.length; i++) {
    const gid = data[i];
    if (gid === 0) {
      continue;
    }

    const rawGid = gid & ~TILED_FLIPPED_FLAGS;
    const blockId = ctx.gidToBlockId.get(rawGid);
    if (blockId === undefined) {
      continue;
    }

    const col = i % cols;
    const row = Math.floor(i / cols);

    // Pack the three Tiled flip bits (H=4, V=2, AD=1) into a 3-bit transform value.
    const transform = (gid >>> 29) & 0x7;
    const key: VoxelEntryKey = `${col},${voxelY},${row}`;

    voxels[key] = { block: blockId, transform };
  }

  return {
    id: `tiled_layer_${layer.id}`,
    name: layer.name,
    visible: layer.visible,
    order: layerOrder,
    voxels
  };
}

function convertObjectLayers(
  layers: TiledAnyLayer[],
  out: VoxelObjectLayerJSON[],
  ctx: ObjectLayerContext
): void {
  for (const layer of layers) {
    if (layer.type === "objectgroup") {
      out.push(convertObjectLayer(layer, ctx));
      ctx.counter.value++;
    }
    else if (layer.type === "group") {
      convertObjectLayers(layer.layers, out, ctx);
    }
  }
}

function convertObjectLayer(
  layer: TiledObjectLayer,
  ctx: ObjectLayerContext
): VoxelObjectLayerJSON {
  const objects: VoxelObjectJSON[] = layer.objects.map((obj) => {
    const result: VoxelObjectJSON = {
      id: String(obj.id),
      name: obj.name,
      // Pixel → voxel-space: divide by tile size; Tiled Y maps to 3-D Z.
      x: obj.x / ctx.map.tilewidth,
      y: 0,
      z: obj.y / ctx.map.tileheight,
      width: obj.width / ctx.map.tilewidth,
      height: obj.height / ctx.map.tileheight,
      rotation: obj.rotation,
      visible: obj.visible
    };

    if (obj.type) {
      result.type = obj.type;
    }

    const properties = flattenProperties(obj.properties);
    if (properties) {
      result.properties = properties;
    }

    return result;
  });

  return {
    id: String(layer.id),
    name: layer.name,
    visible: layer.visible,
    order: ctx.counter.value,
    objects
  };
}

function decodeLayerData(
  layer: TiledTileLayer
): number[] {
  if (layer.chunks && layer.chunks.length > 0) {
    throw new Error(
      `TiledConverter: infinite maps are not supported (layer "${layer.name}" uses chunks). ` +
      "Export your Tiled map as a fixed-size map."
    );
  }

  if (layer.compression) {
    throw new Error(
      `TiledConverter: compressed tile data ("${layer.compression}") is not supported. ` +
      "Export your Tiled map with compression set to \"None\"."
    );
  }

  if (typeof layer.data === "string") {
    return decodeBase64GIDs(layer.data);
  }

  return layer.data;
}

function decodeBase64GIDs(
  base64: string
): number[] {
  let bytes: Uint8Array;

  if (typeof Buffer === "undefined") {
    // Browser: use atob
    const binary = atob(base64);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
  }
  else {
    // Node.js: use Buffer
    const buf = Buffer.from(base64, "base64");
    bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  // GIDs are stored as 4-byte unsigned little-endian integers.
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const count = bytes.byteLength / 4;
  const gids: number[] = new Array(count);

  for (let i = 0; i < count; i++) {
    gids[i] = view.getUint32(i * 4, true);
  }

  return gids;
}

/**
 * Flattens Tiled custom properties to a plain key→scalar map.
 * `color`, `object`, and `class` property types are skipped (not JSON-primitive).
 */
function flattenProperties(
  properties?: TiledProperty[]
): VoxelObjectProperties | undefined {
  if (!properties || properties.length === 0) {
    return undefined;
  }

  const result: VoxelObjectProperties = {};

  for (const prop of properties) {
    if (
      typeof prop.value === "string" ||
      typeof prop.value === "number" ||
      typeof prop.value === "boolean"
    ) {
      result[prop.name] = prop.value;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
