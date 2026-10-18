// Import Third-party Dependencies
import type { KeyBindingHandlers } from "@jolly-pixel/controls";
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type {
  SelectionStore,
  ToolStore
} from "../../state/index.ts";
import { CellRegion } from "../placement/CellRegion.ts";
import type { MapPlacement } from "../placement/MapPlacement.ts";

export interface MarqueeShortcutsOptions {
  world: VoxelWorld;
  tool: ToolStore;
  selection: Pick<SelectionStore, "voxelLayer">;
  placement: Pick<
    MapPlacement,
    "current" | "lifted" | "commit" | "liftRegion" | "deleteRegion"
  >;
}

export function marqueeShortcuts(
  options: MarqueeShortcutsOptions
): KeyBindingHandlers<"edit.delete" | "edit.selectLayer"> {
  const {
    world,
    tool,
    selection,
    placement
  } = options;

  function selectLayer(): boolean {
    const layerName = selection.voxelLayer;
    if (
      !tool.selecting ||
      layerName === null ||
      (placement.lifted === null && placement.current !== null)
    ) {
      return false;
    }

    placement.commit();
    const bounds = world.getLayer(layerName)?.worldBounds() ?? null;

    return bounds !== null && placement.liftRegion(
      layerName,
      CellRegion.fromBox(bounds)
    );
  }

  return {
    "edit.delete": () => placement.deleteRegion(),
    "edit.selectLayer": selectLayer
  };
}
