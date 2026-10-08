// Import Internal Dependencies
import {
  voxelPatchesRestoring,
  type VoxelCellChange,
  type VoxelWorld
} from "../../src/document/world/index.ts";

export interface WorldHistory {
  undo(): boolean;
  redo(): boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export function worldHistory(
  world: VoxelWorld
): WorldHistory {
  const undone: VoxelCellChange[][] = [];
  const redone: VoxelCellChange[][] = [];
  let recorded: VoxelCellChange[] = [];
  world.addRecorder({
    record: (changes) => recorded.push(...changes)
  });
  world.on("command", () => {
    if (recorded.length > 0) {
      undone.push(recorded);
      redone.length = 0;
    }
    recorded = [];
  });

  function step(
    from: VoxelCellChange[][],
    to: VoxelCellChange[][],
    side: "before" | "after"
  ): boolean {
    const changes = from.pop();
    if (changes === undefined) {
      return false;
    }

    world.unrecorded(() => {
      for (const [layerId, patch] of voxelPatchesRestoring(changes, side)) {
        world.patchVoxels(
          world.getLayerById(layerId)!.name,
          patch.cells,
          patch.partners
        );
      }
    });
    to.push(changes);

    return true;
  }

  return {
    undo: () => step(undone, redone, "before"),
    redo: () => step(redone, undone, "after"),
    get canUndo() {
      return undone.length > 0;
    },
    get canRedo() {
      return redone.length > 0;
    }
  };
}
