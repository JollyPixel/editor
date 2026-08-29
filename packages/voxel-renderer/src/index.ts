// VoxelEngine
export {
  VoxelEngine,
  VoxelRotation,
  type VoxelEngineOptions,
  type VoxelLoadOptions,
  type VoxelSetOptions,
  type VoxelRemoveOptions,
  type VoxelLogger
} from "./VoxelEngine.ts";

// VoxelRenderer
export {
  VoxelRenderer,
  type VoxelRendererOptions
} from "./VoxelRenderer.ts";
export * from "./hooks.ts";

// Debug
export {
  VoxelDebugger,
  type VoxelDebugMode,
  type VoxelDebugStats,
  type VoxelDebuggerOptions
} from "./debug/VoxelDebugger.ts";
export { MeshBuildStats } from "./mesh/MeshBuildStats.ts";

// Built-in shapes
export { Cube } from "./blocks/shapes/Cube.ts";
export { Slab, type SlabType } from "./blocks/shapes/Slab.ts";
export { PoleY } from "./blocks/shapes/PoleY.ts";
export { Pole } from "./blocks/shapes/Pole.ts";
export { Ramp } from "./blocks/shapes/Ramp.ts";
export {
  RampCornerInner,
  RampCornerOuter
} from "./blocks/shapes/RampCorner.ts";
export {
  Stair,
  StairCornerInner,
  StairCornerOuter
} from "./blocks/shapes/Stair.ts";

// Blocks
export { BlockRegistry } from "./blocks/BlockRegistry.ts";
export type {
  BlockDefinition,
  BlockDefinitionIn
} from "./blocks/BlockDefinition.ts";
export { BlockShapeRegistry } from "./blocks/BlockShapeRegistry.ts";
export type {
  BlockShape,
  BlockShapeID,
  BlockCollisionHint,
  FaceDefinition
} from "./blocks/BlockShape.ts";

// Collision
export {
  mergeChunkGeometries,
  type VoxelCollider,
  type VoxelChunkCollision,
  type VoxelColliderContext,
  type VoxelColliderFactory
} from "./collision/index.ts";

// Serialization
export {
  VoxelSerializer,
  type VoxelWorldJSON,
  type VoxelObjectJSON,
  type VoxelObjectLayerJSON,
  type VoxelObjectProperties
} from "./serialization/VoxelSerializer.ts";
export {
  normalizeVoxelExtent,
  voxelObjectFootprint,
  type VoxelObjectFootprint
} from "./serialization/voxelObject.ts";

// Tileset
export {
  TilesetManager,
  type TilesetManagerOptions,
  type TilesetDefaultBlockOptions,
  type TilesetUVRegion,
  type TilesetImage,
  type TileRef,
  type TilesetDefinition,
  type ResolvedTilesetDefinition
} from "./tileset/TilesetManager.ts";
export {
  resolveTilesetDefinition,
  type AtlasSize
} from "./tileset/types.ts";
export {
  TilesetLoader,
  type TilesetLoaderOptions,
  type TilesetEntry
} from "./tileset/TilesetLoader.ts";
export { enableTileWrapping } from "./tileset/tileWrapping.ts";
export type { AtlasRegion } from "./tileset/atlasLayout.ts";

// World
export {
  VoxelWorld
} from "./world/VoxelWorld.ts";
export {
  VoxelLayer,
  type VoxelEntryKey,
  type VoxelEntryJSON,
  type VoxelLayerJSON,
  type VoxelLayerConfigurableOptions,
  type VoxelLayerOptions
} from "./world/VoxelLayer.ts";
export { VoxelChunk, DEFAULT_CHUNK_SIZE } from "./world/VoxelChunk.ts";
export { VoxelStore } from "./world/VoxelStore.ts";
export {
  packVoxel,
  unpackVoxel,
  voxelBlockId,
  voxelTransform,
  MAX_BLOCK_ID,
  VOXEL_ABSENT,
  type PackedVoxel
} from "./world/packedVoxel.ts";
export type {
  VoxelCoord,
  VoxelEntry
} from "./world/types.ts";
export {
  voxelCellOf,
  voxelPositionOf
} from "./world/voxelCoord.ts";

// Math
export {
  FACE as Face
} from "./utils/math.ts";
