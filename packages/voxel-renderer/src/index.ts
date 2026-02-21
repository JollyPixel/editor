// VoxelRenderer — public API
export {
  VoxelRenderer,
  VoxelRotation,
  type VoxelRendererOptions,
  type VoxelSetOptions,
  type VoxelRemoveOptions
} from "./VoxelRenderer.ts";
export * from "./hooks.ts";

// Built-in shapes
export { Cube } from "./blocks/shapes/Cube.ts";
export { Slab, type SlabType } from "./blocks/shapes/Slab.ts";
export { PoleY } from "./blocks/shapes/PoleY.ts";
export { Pole, type PoleAxis } from "./blocks/shapes/Pole.ts";
export { PoleCross } from "./blocks/shapes/PoleCross.ts";
export { Ramp } from "./blocks/shapes/Ramp.ts";
export { RampFlip } from "./blocks/shapes/RampFlip.ts";
export {
  RampCornerInner,
  RampCornerOuter,
  RampCornerInnerFlip,
  RampCornerOuterFlip
} from "./blocks/shapes/RampCorner.ts";
export {
  Stair,
  StairCornerInner,
  StairCornerOuter,
  StairFlip,
  StairCornerInnerFlip,
  StairCornerOuterFlip
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

// Collision
export {
  VoxelColliderBuilder,
  type VoxelColliderBuilderOptions,
  type RapierAPI,
  type RapierWorld,
  type RapierCollider
} from "./collision/VoxelColliderBuilder.ts";

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
  type TilesetUVRegion,
  type TileRef,
  type TilesetDefinition
} from "./tileset/TilesetManager.ts";

// World
export { VoxelWorld } from "./world/VoxelWorld.ts";
export {
  VoxelLayer,
  type VoxelEntryKey,
  type VoxelEntryJSON,
  type VoxelLayerJSON,
  type VoxelLayerConfigurableOptions,
  type VoxelLayerOptions
} from "./world/VoxelLayer.ts";
export { VoxelChunk, DEFAULT_CHUNK_SIZE } from "./world/VoxelChunk.ts";
export type {
  VoxelCoord,
  VoxelEntry
} from "./world/types.ts";

// Convertor
export * from "./convertor/index.ts";

// Math
export {
  FACE as Face
} from "./utils/math.ts";
