// Import Internal Dependencies
import type { VoxelLayerHookEvent } from "../../src/hooks.ts";

type AddedCommand = Extract<VoxelLayerHookEvent, { action: "added"; }>;

/** An added-layer hook event with empty options, keyed by layer name. */
export function makeAddedCommand(
  layerName: string
): AddedCommand {
  return {
    action: "added",
    layerName,
    metadata: { options: {} }
  };
}
