// Import Third-party Dependencies
import {
  commandVariant,
  MessageProtocol,
  withCommandHeader
} from "@jolly-pixel/network";
import {
  CHUNK_TIERS,
  LOOKUP_SIZE,
  MATERIAL_SLOT_COUNT,
  tileCount,
  TILES_PER_CHUNK
} from "@jolly-pixel/terrain.renderer";
import * as z from "zod/mini";

// CONSTANTS
export const MAX_PATCH_TILES = 1024;
export const MAX_TERRAIN_CHUNKS = 4096;
export const CHUNK_TILE_COUNT = TILES_PER_CHUNK * TILES_PER_CHUNK;
export const CHUNK_COORDINATE_RANGE = {
  min: -LOOKUP_SIZE / 2,
  max: LOOKUP_SIZE / 2 - 1
} as const;
const kChunkCoordinate = z.int().check(
  z.gte(CHUNK_COORDINATE_RANGE.min),
  z.lte(CHUNK_COORDINATE_RANGE.max)
);
const kChunkTier = z.literal(CHUNK_TIERS);
const kRefinedTier = z.optional(z.literal([2, 4]));
const kRefinedTileIndex = z.int().check(z.gte(0), z.lt(tileCount(4)));

export const tilePatchSchema = z.object({
  x: kChunkCoordinate,
  z: kChunkCoordinate,
  tile: kRefinedTileIndex,
  tier: kRefinedTier,
  heights: z.string()
});

export const tilePatchesSchema = z.array(tilePatchSchema).check(
  z.minLength(1),
  z.maxLength(MAX_PATCH_TILES)
);

export const splatTilePatchSchema = z.object({
  x: kChunkCoordinate,
  z: kChunkCoordinate,
  tile: z.int().check(z.gte(0), z.lt(CHUNK_TILE_COUNT)),
  splat: z.string()
});

export const splatTilePatchesSchema = z.array(splatTilePatchSchema).check(
  z.minLength(1),
  z.maxLength(MAX_PATCH_TILES)
);

export const holeTilePatchSchema = z.object({
  x: kChunkCoordinate,
  z: kChunkCoordinate,
  tile: kRefinedTileIndex,
  tier: kRefinedTier,
  holes: z.string()
});

export const holeTilePatchesSchema = z.array(holeTilePatchSchema).check(
  z.minLength(1),
  z.maxLength(MAX_PATCH_TILES)
);

export const TERRAIN_TEXTURE_SIZES = [512, 1024, 2048] as const;
export const MAX_TERRAIN_MATERIALS = 32;
export const TERRAIN_MATERIAL_ACTIONS = [
  "material-added",
  "material-updated",
  "material-removed",
  "texture-size-changed"
] as const;
const kTextureSize = z.literal(TERRAIN_TEXTURE_SIZES);
const kMaterialId = z.string().check(z.minLength(1), z.maxLength(64));
const kMaterialMap = z.nullable(z.object({
  id: z.string().check(z.minLength(1)),
  kind: z.string().check(z.minLength(1))
}));

export const materialPropertiesSchema = z.object({
  name: z.string().check(z.maxLength(64)),
  albedo: kMaterialMap,
  normal: kMaterialMap,
  orm: kMaterialMap,
  height: kMaterialMap,
  tiling: z.number().check(z.gt(0), z.lte(1024)),
  triplanar: z.boolean(),
  stochastic: z.boolean(),
  heightBlend: z.boolean(),
  displacementScale: z.number().check(z.gte(0))
});

export const terrainMaterialSchema = z.extend(materialPropertiesSchema, {
  id: kMaterialId,
  slot: z.int().check(z.gte(0), z.lt(MATERIAL_SLOT_COUNT))
});

export const chunkEntrySchema = z.object({
  x: kChunkCoordinate,
  z: kChunkCoordinate,
  overview: z.optional(z.string()),
  materials: z.optional(z.string()),
  heights: z.optional(z.string()),
  splat: z.optional(z.string()),
  holes: z.optional(z.string()),
  hasHoles: z.optional(z.literal(true)),
  tier: kRefinedTier
});

export const MAX_POINTS_OF_INTEREST = 64;
export const POI_LOD_BIAS = { min: 1, max: 8 } as const;
export const POI_MIN_LEVEL = { min: 0, max: 5 } as const;
export const POI_PRIORITY = { min: 0, max: 9 } as const;
export const TERRAIN_POI_ACTIONS = ["poi-added", "poi-updated", "poi-removed"] as const;
const kPoiId = z.string().check(z.minLength(1), z.maxLength(64));

export const poiPropertiesSchema = z.object({
  name: z.string().check(z.maxLength(64)),
  lodBias: z.number().check(z.gte(POI_LOD_BIAS.min), z.lte(POI_LOD_BIAS.max)),
  minLevel: z.int().check(z.gte(POI_MIN_LEVEL.min), z.lte(POI_MIN_LEVEL.max)),
  priority: z.int().check(z.gte(POI_PRIORITY.min), z.lte(POI_PRIORITY.max)),
  chunks: z.array(z.object({ x: kChunkCoordinate, z: kChunkCoordinate }))
    .check(z.maxLength(MAX_TERRAIN_CHUNKS))
});

export const pointOfInterestSchema = z.extend(poiPropertiesSchema, {
  id: kPoiId
});

export const terrainManifestSchema = z.object({
  chunks: z.array(chunkEntrySchema),
  materials: z.optional(
    z.array(terrainMaterialSchema).check(z.maxLength(MAX_TERRAIN_MATERIALS))
  ),
  textureSize: z.optional(kTextureSize),
  pointsOfInterest: z.optional(
    z.array(pointOfInterestSchema).check(z.maxLength(MAX_POINTS_OF_INTEREST))
  )
});

export const terrainPartSchema = z.string();

export const terrainCommandSchema = z.discriminatedUnion("action", [
  commandVariant("chunk-added", {
    x: kChunkCoordinate,
    z: kChunkCoordinate,
    heights: z.string(),
    splat: z.optional(z.string()),
    holes: z.optional(z.string())
  }),
  commandVariant("chunk-removed", {
    x: kChunkCoordinate,
    z: kChunkCoordinate
  }),
  commandVariant("tier-changed", {
    x: kChunkCoordinate,
    z: kChunkCoordinate,
    tier: kChunkTier,
    heights: z.string(),
    holes: z.optional(z.string())
  }),
  commandVariant("heights-patched", {
    tiles: tilePatchesSchema
  }),
  commandVariant("splat-patched", {
    tiles: splatTilePatchesSchema
  }),
  commandVariant("holes-patched", {
    tiles: holeTilePatchesSchema
  }),
  commandVariant("material-added", {
    material: terrainMaterialSchema
  }),
  commandVariant("material-updated", {
    id: kMaterialId,
    changes: z.partial(materialPropertiesSchema)
  }),
  commandVariant("material-removed", {
    id: kMaterialId
  }),
  commandVariant("texture-size-changed", {
    size: kTextureSize
  }),
  commandVariant("poi-added", {
    poi: pointOfInterestSchema
  }),
  commandVariant("poi-updated", {
    id: kPoiId,
    changes: z.partial(poiPropertiesSchema)
  }),
  commandVariant("poi-removed", {
    id: kPoiId
  })
]);

export const terrainCommandProtocol: MessageProtocol = new MessageProtocol(
  z.union(terrainCommandSchema.def.options.map(withCommandHeader))
);
