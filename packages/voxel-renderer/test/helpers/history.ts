// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import { CommandHistory } from "@jolly-pixel/history";

// Import Internal Dependencies
import type { BlockDocumentEvents } from "../../src/document/BlockDocument.ts";
import type { VoxelCommand } from "../../src/document/commands/index.ts";
import {
  VoxelEdits,
  voxelHistoryRegistration
} from "../../src/document/history/index.ts";
import type { VoxelWorld } from "../../src/document/world/index.ts";

export const VOXEL_SCOPE = "voxels";

export interface WorldHistory {
  history: CommandHistory<typeof VOXEL_SCOPE>;
  edits: VoxelEdits;
  undo(): boolean;
  redo(): boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export function worldHistory(
  world: VoxelWorld
): WorldHistory {
  const edits = new VoxelEdits(
    world,
    new Emitter<BlockDocumentEvents<VoxelCommand>>()
  );
  const history = new CommandHistory({ scopes: [VOXEL_SCOPE] });
  history.register(voxelHistoryRegistration({ edits, world }, { scope: VOXEL_SCOPE }));

  return {
    history,
    edits,
    undo: () => history.undo(VOXEL_SCOPE),
    redo: () => history.redo(VOXEL_SCOPE),
    get canUndo() {
      return history.state(VOXEL_SCOPE).canUndo;
    },
    get canRedo() {
      return history.state(VOXEL_SCOPE).canRedo;
    }
  };
}
