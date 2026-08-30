// Import Third-party Dependencies
import type {
  ResolvedBlockDefinition,
  VoxelRenderer
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { editorState } from "../../EditorState.ts";

export function applyBlockUpdates(
  vr: VoxelRenderer,
  updates: Iterable<ResolvedBlockDefinition>
): void {
  let changed = false;
  for (const update of updates) {
    vr.engine.blockRegistry.register(update);
    changed = true;
  }
  if (!changed) {
    return;
  }

  vr.engine.markAllChunksDirty("block definitions updated");
  editorState.dispatchBlockRegistryChanged();
}

export function applyBlockUpdate(
  vr: VoxelRenderer,
  update: ResolvedBlockDefinition
): void {
  applyBlockUpdates(vr, [update]);
}
