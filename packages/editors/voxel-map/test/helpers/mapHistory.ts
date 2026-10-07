// Import Third-party Dependencies
import type { CommandHistory } from "@jolly-pixel/history";
import {
  VoxelEdits,
  type BlockDocumentEvents,
  type VoxelCommand,
  type VoxelWorld
} from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  createMapHistory,
  type MapHistoryScope
} from "../../src/shared/mapHistory.ts";

export function mapHistoryOf(
  world: VoxelWorld
): CommandHistory<MapHistoryScope> {
  return createMapHistory({
    edits: new VoxelEdits(
      world,
      new Emitter<BlockDocumentEvents<VoxelCommand>>()
    ),
    world
  });
}
