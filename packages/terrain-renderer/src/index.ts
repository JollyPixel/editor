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
  TerrainView,
  type TerrainViewOptions
} from "./view/TerrainView.ts";
export { LOOKUP_SIZE } from "./view/textures/ChunkTextureStore.ts";
export {
  DEFAULT_MATERIAL_TEXTURE_SIZE,
  MATERIAL_MAPS,
  MATERIAL_SLOT_COUNT,
  type MaterialImage,
  type MaterialMap,
  type MaterialSurface,
  type TextureCopier
} from "./view/textures/MaterialTextureStore.ts";
