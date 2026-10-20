export {
  CHUNK_SAMPLES,
  ChunkCoord,
  type ChunkKey
} from "./document/ChunkCoord.ts";
export type { SampleBlock } from "./document/SampleBlock.ts";
export {
  CHUNK_SAMPLE_COUNT,
  HEIGHT_RANGE,
  isValidHeight,
  type HeightRange,
  type TerrainChunk
} from "./document/TerrainChunk.ts";
export {
  TerrainDocument,
  type TerrainReader
} from "./document/TerrainDocument.ts";
export {
  TILE_SAMPLE_COUNT,
  TILE_SAMPLES,
  TILES_PER_CHUNK,
  TileCoord,
  type TileKey,
  type TilePatch
} from "./document/TileCoord.ts";
export {
  raycastTerrain,
  surfaceHeight,
  type TerrainHit,
  type TerrainRay
} from "./document/terrainSurface.ts";
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
