// Import Third-party Dependencies
import {
  DEFAULT_CHUNK_SIZE,
  rankBetween,
  serializeVoxelLayer,
  VOXEL_WORLD_VERSION,
  VoxelFootprint,
  VoxelLayer,
  type BlockShapeID,
  type ResolvedBlockDefinition,
  type BlocksetDefinition,
  type VoxelLayerJSON,
  type VoxelObjectJSON,
  type VoxelObjectLayerJSON,
  type VoxelObjectProperties,
  type VoxelWorldJSON
} from "@jolly-pixel/voxel.renderer";

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

export interface TiledConverterOptions {
  /**
   * Resolves a Tiled tileset source and derived ID to an asset URL.
   */
  resolveTilesetSrc: (tiledSource: string, blocksetId: string) => string;

  /**
   * Chunk size written into the VoxelWorldJSON output.
   * @default 16
   */
  chunkSize?: number;

  /**
   * Maps layers to Y=0 (`"flat"`) or their layer index (`"stacked"`).
   * @default "flat"
   */
  layerMode?: "flat" | "stacked";

  /**
   * BlockShape ID assigned to every generated block.
   * @default "cube"
   */
  defaultShapeId?: BlockShapeID;

  /**
   * Whether generated blocks are collidable.
   * @default true
   */
  collidable?: boolean;
}

interface BlocksetBuildContext {
  options: TiledConverterOptions;
  blocksetIds: Map<number, string>;
}

interface BlockBuildContext {
  tileSets: TileSet[];
  blocksetIds: Map<number, string>;
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
 * A converted map: the world with its blockset links, and the blocks the
 * world's tiles were turned into, one per unique tile.
 */
export interface TiledConversion {
  world: VoxelWorldJSON;
  blocks: ResolvedBlockDefinition[];
}

export class TiledConverter {
  convert(
    map: TiledMap,
    options: TiledConverterOptions
  ): TiledConversion {
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

    const blocksetIds = new Map<number, string>();
    for (let i = 0; i < map.tilesets.length; i++) {
      blocksetIds.set(map.tilesets[i].firstgid, deriveBlocksetId(map.tilesets[i], i));
    }

    const blocksetCtx: BlocksetBuildContext = { options, blocksetIds };
    const blocksets = map.tilesets.map((ts, i) => buildBlocksetDefinition(ts, i, blocksetCtx));

    const rawGids = new Set<number>();
    collectGIDs(map.layers, rawGids);

    const blockCtx: BlockBuildContext = { tileSets, blocksetIds, options };
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

    const world: VoxelWorldJSON = {
      version: VOXEL_WORLD_VERSION,
      chunkSize: options.chunkSize ?? DEFAULT_CHUNK_SIZE,
      blocksets,
      layers
    };

    if (objectLayers.length > 0) {
      world.objectLayers = objectLayers;
    }

    return {
      world,
      blocks
    };
  }
}

function deriveBlocksetId(
  tileset: TiledMapTileset,
  index: number
): string {
  if (tileset.name) {
    return tileset.name;
  }
  if (tileset.source) {
    const filename = tileset.source.split(/[/\\]/).at(-1) ?? tileset.source;
    const dotIndex = filename.lastIndexOf(".");

    return dotIndex > 0 ? filename.slice(0, dotIndex) : filename;
  }

  return `tileset_${index}`;
}

function buildBlocksetDefinition(
  ts: TiledMapTileset,
  index: number,
  ctx: BlocksetBuildContext
): BlocksetDefinition {
  const id = ctx.blocksetIds.get(ts.firstgid) ?? deriveBlocksetId(ts, index);
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
): { blocks: ResolvedBlockDefinition[]; gidToBlockId: Map<number, number>; } {
  const blocks: ResolvedBlockDefinition[] = [];
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

    const blocksetId = ctx.blocksetIds.get(tileSet.firstgid) ?? tileSet.name;
    const localId = tileSet.getTileLocalId(rawGid);
    const blockId = nextId++;

    gidToBlockId.set(rawGid, blockId);

    blocks.push({
      id: blockId,
      name: `${blocksetId}_${localId}`,
      shapeId: ctx.options.defaultShapeId ?? "cube",
      properties: {},
      faceTextures: {},
      defaultTexture: {
        col: props.coords.x,
        row: props.coords.y,
        blocksetId
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
      out.push(convertTileLayer(
        layer,
        ctx,
        rankBetween(out.at(-1)?.rank ?? null, null)
      ));
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
  rank: string
): VoxelLayerJSON {
  const data = decodeLayerData(layer);
  const voxelLayer = new VoxelLayer({
    id: `tiled_layer_${layer.id}`,
    name: layer.name,
    visible: layer.visible,
    order: 0,
    rank,
    chunkSize: ctx.options.chunkSize ?? DEFAULT_CHUNK_SIZE,
    properties: flattenProperties(layer.properties)
  });

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

    voxelLayer.setVoxelAt(
      {
        x: i % cols,
        y: voxelY,
        z: Math.floor(i / cols)
      },
      {
        blockId,
        transform: (gid >>> 29) & 0x7
      }
    );
  }

  return serializeVoxelLayer(voxelLayer);
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
    const footprint = new VoxelFootprint(
      obj.width / ctx.map.tilewidth,
      obj.height / ctx.map.tileheight
    );
    const result: VoxelObjectJSON = {
      id: String(obj.id),
      name: obj.name,
      x: obj.x / ctx.map.tilewidth,
      y: 0,
      z: obj.y / ctx.map.tileheight,
      width: footprint.width,
      height: footprint.height,
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
    const binary = atob(base64);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
  }
  else {
    const buf = Buffer.from(base64, "base64");
    bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset);
  const count = bytes.byteLength / 4;
  // oxlint-disable-next-line unicorn/no-new-array
  const gids: number[] = new Array(count);

  for (let i = 0; i < count; i++) {
    gids[i] = view.getUint32(i * 4, true);
  }

  return gids;
}

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
