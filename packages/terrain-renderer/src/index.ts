export {
  CHUNK_SAMPLES,
  ChunkCoord,
  type ChunkKey
} from "./terrain/ChunkCoord.ts";
export {
  OVERVIEW_SAMPLE_COUNT,
  OVERVIEW_SAMPLES,
  OVERVIEW_SPACING,
  OverviewMap,
  isOverviewTile,
  overviewSamples,
  type OverviewReader
} from "./terrain/OverviewMap.ts";
export type { SampleBlock } from "./terrain/SampleBlock.ts";
export {
  HOLE_BYTES,
  HOLE_TILE_BYTES,
  type HoleMask
} from "./terrain/HoleMask.ts";
export {
  dominantSlot,
  isValidSplat,
  SPLAT_CHANNELS,
  SPLAT_TEXEL_COUNT,
  SPLAT_TEXELS,
  SPLAT_TILE_TEXEL_COUNT,
  SPLAT_TILE_TEXELS,
  SPLAT_WEIGHT_TOTAL,
  SplatMap,
  uniformSplat,
  type SplatTexels
} from "./terrain/SplatMap.ts";
export {
  CHUNK_SAMPLE_COUNT,
  HEIGHT_RANGE,
  isValidHeight,
  type HeightRange,
  type TerrainChunk
} from "./terrain/TerrainChunk.ts";
export {
  Terrain,
  type TerrainReader
} from "./terrain/Terrain.ts";
export {
  TILE_SAMPLE_COUNT,
  TILE_SAMPLES,
  TILES_PER_CHUNK,
  TileCoord,
  type TileKey,
  type TilePatch
} from "./terrain/TileCoord.ts";
export {
  raycastTerrain,
  surfaceHeight,
  type TerrainHit,
  type TerrainRay
} from "./terrain/terrainSurface.ts";
export type { Point3 } from "./math/point3.ts";
export {
  LodRanges,
  type LodRangesOptions
} from "./view/lod/LodRanges.ts";
export type {
  NodeBounds,
  SelectedNode
} from "./view/lod/QuadtreeSelection.ts";
export {
  DEFAULT_WALKABLE_SLOPE,
  MAX_WALKABLE_SLOPE,
  TERRAIN_OVERLAYS,
  type TerrainOverlay
} from "./view/shading/terrainNodes.ts";
export {
  splatOverlayColor,
  type SplatColor
} from "./view/shading/splatColors.ts";
export {
  TerrainView,
  type TerrainViewOptions
} from "./view/TerrainView.ts";
export { LOOKUP_SIZE } from "./view/textures/ChunkTextureStore.ts";
export {
  DEFAULT_MATERIAL_TEXTURE_SIZE,
  MATERIAL_MAPS,
  MATERIAL_SLOT_COUNT,
  MATERIAL_TECHNIQUES,
  type MaterialImage,
  type MaterialMap,
  type MaterialSurface,
  type MaterialTechnique,
  type TextureCopier
} from "./view/textures/MaterialTextureStore.ts";
