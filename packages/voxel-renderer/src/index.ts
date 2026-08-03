// VoxelEngine — engine-agnostic core (no @jolly-pixel/engine dependency)
export {
  VoxelEngine,
  VoxelRotation,
  type VoxelEngineOptions,
  type VoxelLoadOptions,
  type VoxelSetOptions,
  type VoxelRemoveOptions,
  type VoxelLogger
} from "./VoxelEngine.ts";

// VoxelRenderer — ActorComponent wrapper around VoxelEngine
export {
  VoxelRenderer,
  type VoxelRendererOptions
} from "./VoxelRenderer.ts";
export * from "./hooks.ts";

// Debug — mesh statistics and wireframe visualization
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
export type { BlockDefinition } from "./blocks/BlockDefinition.ts";
export { BlockShapeRegistry } from "./blocks/BlockShapeRegistry.ts";
export type {
  BlockShape,
  BlockShapeID,
  BlockCollisionHint,
  FaceDefinition
} from "./blocks/BlockShape.ts";

// Collision — physics-agnostic contract.
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

// Tileset
export {
  TilesetManager,
  type TilesetManagerOptions,
  type TilesetDefaultBlockOptions,
  type TilesetUVRegion,
  type TilesetImage,
  type TileRef,
  type TilesetDefinition
} from "./tileset/TilesetManager.ts";
export {
  TilesetLoader,
  type TilesetLoaderOptions,
  type TilesetEntry
} from "./tileset/TilesetLoader.ts";
export { enableTileWrapping } from "./tileset/tileWrapping.ts";

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

// Math
export {
  FACE as Face
} from "./utils/math.ts";
