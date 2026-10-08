// Import Third-party Dependencies
import type { CommandHistory } from "@jolly-pixel/history";
import { VoxelEdits } from "@jolly-pixel/asset.voxel-map/client";
import type {
  BlockDocumentEvents,
  VoxelCommand,
  VoxelWorld
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
  const document = Object.assign(
    new Emitter<BlockDocumentEvents<VoxelCommand>>(),
    { world }
  );
  world.on("command", (command) => document.emit("command", command, { origin: "local" }));

  return createMapHistory(new VoxelEdits(document));
}
