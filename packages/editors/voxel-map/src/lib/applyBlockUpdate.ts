// Import Third-party Dependencies
import type {
  VoxelRenderer,
  BlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { editorState } from "../EditorState.ts";

/**
 * Registers an updated block definition and rebuilds placed voxels/preview
 * state that depend on it. All block mutations (BlockLibrary's own inputs,
 * BlockUvBridge's UV-region drags) route through here.
 */
export function applyBlockUpdate(
  vr: VoxelRenderer,
  updated: BlockDefinition
): void {
  vr.engine.blockRegistry.register(updated);
  vr.engine.markAllChunksDirty("BlockLibrary update");
  editorState.dispatchBlockRegistryChanged();
}
