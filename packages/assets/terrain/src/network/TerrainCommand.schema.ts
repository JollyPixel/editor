// Import Third-party Dependencies
import {
  commandVariant,
  MessageProtocol,
  withCommandHeader
} from "@jolly-pixel/network";
import {
  LOOKUP_SIZE,
  TILES_PER_CHUNK
} from "@jolly-pixel/terrain.renderer";
import * as z from "zod/mini";

// CONSTANTS
export const MAX_PATCH_TILES = 1024;
export const CHUNK_TILE_COUNT = TILES_PER_CHUNK * TILES_PER_CHUNK;
export const CHUNK_COORDINATE_RANGE = {
  min: -LOOKUP_SIZE / 2,
  max: LOOKUP_SIZE / 2 - 1
} as const;
const kChunkCoordinate = z.int().check(
  z.gte(CHUNK_COORDINATE_RANGE.min),
  z.lte(CHUNK_COORDINATE_RANGE.max)
);

export const tilePatchSchema = z.object({
  x: kChunkCoordinate,
  z: kChunkCoordinate,
  tile: z.int().check(z.gte(0), z.lt(CHUNK_TILE_COUNT)),
  heights: z.string()
});

export const tilePatchesSchema = z.array(tilePatchSchema).check(
  z.minLength(1),
  z.maxLength(MAX_PATCH_TILES)
);

export const TERRAIN_TEXTURE_SIZES = [512, 1024, 2048] as const;
export const MAX_TERRAIN_LAYERS = 32;
export const TERRAIN_LAYER_SLOTS = 256;
const kTextureSize = z.literal(TERRAIN_TEXTURE_SIZES);
const kLayerId = z.string().check(z.minLength(1), z.maxLength(64));
const kLayerMap = z.nullable(z.object({
  id: z.string().check(z.minLength(1)),
  kind: z.string().check(z.minLength(1))
}));

export const layerPropertiesSchema = z.object({
  name: z.string().check(z.maxLength(64)),
  albedo: kLayerMap,
  normal: kLayerMap,
  orm: kLayerMap,
  tiling: z.number().check(z.gt(0), z.lte(1024)),
  triplanar: z.boolean(),
  stochastic: z.boolean(),
  heightBlend: z.boolean(),
  displacementScale: z.number().check(z.gte(0))
});

export const terrainLayerSchema = z.extend(layerPropertiesSchema, {
  id: kLayerId,
  slot: z.int().check(z.gte(0), z.lt(TERRAIN_LAYER_SLOTS))
});

export const chunkEntrySchema = z.object({
  x: kChunkCoordinate,
  z: kChunkCoordinate,
  overview: z.optional(z.string()),
  heights: z.optional(z.string())
});

export const terrainManifestSchema = z.object({
  chunks: z.array(chunkEntrySchema),
  layers: z.optional(
    z.array(terrainLayerSchema).check(z.maxLength(MAX_TERRAIN_LAYERS))
  ),
  textureSize: z.optional(kTextureSize)
});

export const terrainPartSchema = z.string();

export const terrainCommandSchema = z.discriminatedUnion("action", [
  commandVariant("chunk-added", {
    x: kChunkCoordinate,
    z: kChunkCoordinate,
    heights: z.string()
  }),
  commandVariant("chunk-removed", {
    x: kChunkCoordinate,
    z: kChunkCoordinate
  }),
  commandVariant("heights-patched", {
    tiles: tilePatchesSchema
  }),
  commandVariant("layer-added", {
    layer: terrainLayerSchema
  }),
  commandVariant("layer-updated", {
    id: kLayerId,
    changes: z.partial(layerPropertiesSchema)
  }),
  commandVariant("layer-removed", {
    id: kLayerId
  }),
  commandVariant("texture-size-changed", {
    size: kTextureSize
  })
]);

export const terrainCommandProtocol: MessageProtocol = new MessageProtocol(
  z.union(terrainCommandSchema.def.options.map(withCommandHeader))
);
