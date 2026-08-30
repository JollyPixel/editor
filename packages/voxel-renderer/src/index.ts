export {
  VoxelEngine,
  VoxelRotation,
  type VoxelEngineOptions,
  type VoxelLoadOptions,
  type VoxelSetOptions,
  type VoxelRemoveOptions,
  type VoxelLogger
} from "./VoxelEngine.ts";

export {
  VoxelRenderer,
  type VoxelRendererOptions
} from "./VoxelRenderer.ts";
export * from "./hooks.ts";

export {
  VoxelDebugger,
  type VoxelDebugMode,
  type VoxelDebugStats,
  type VoxelDebuggerOptions
} from "./debug/VoxelDebugger.ts";
export { MeshBuildStats } from "./mesh/MeshBuildStats.ts";

export * from "./blocks/shapes/index.ts";

export { BlockRegistry } from "./blocks/BlockRegistry.ts";
export {
  resolveBlockDefinition,
  type BlockDefinition,
  type ResolvedBlockDefinition
} from "./blocks/BlockDefinition.ts";
export { BlockShapeRegistry } from "./blocks/BlockShapeRegistry.ts";
export type {
  BlockShape,
  BlockShapeID,
  BlockCollisionHint,
  FaceDefinition
} from "./blocks/BlockShape.ts";

export {
  mergeChunkGeometries,
  type VoxelCollider,
  type VoxelChunkCollision,
  type VoxelColliderContext,
  type VoxelColliderFactory
} from "./collision/index.ts";

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

export {
  TilesetManager,
  type TilesetManagerOptions,
  type TilesetDefaultBlockOptions,
  type TilesetUVRegion,
  type TilesetImage,
  type ResolvedTileRef,
  type TilesetDefinition,
  type ResolvedTilesetDefinition
} from "./tileset/TilesetManager.ts";
export type {
  AtlasSize,
  Coords,
  TileRef
} from "./tileset/types.ts";
export {
  resolveTileRef,
  resolveTilesetDefinition
} from "./tileset/resolve.ts";
export {
  TilesetLoader,
  type TilesetLoaderOptions,
  type TilesetEntry
} from "./tileset/TilesetLoader.ts";
export { enableTileWrapping } from "./tileset/tileWrapping.ts";
export type { AtlasRegion } from "./tileset/atlasLayout.ts";

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

export {
  FACE as Face
} from "./utils/math.ts";
