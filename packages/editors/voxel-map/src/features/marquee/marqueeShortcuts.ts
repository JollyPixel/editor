// Import Third-party Dependencies
import type {
  Keyboard,
  KeyChordString
} from "@jolly-pixel/controls";
import type { VoxelWorld } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type {
  SelectionStore,
  ToolStore
} from "../../state/index.ts";
import { CellRegion } from "../placement/CellRegion.ts";
import type { MapPlacement } from "../placement/MapPlacement.ts";

export const MARQUEE_SHORTCUTS = {
  delete: ["Delete", "Backspace"],
  selectLayer: ["Mod+a"]
} as const satisfies Record<string, readonly KeyChordString[]>;

export interface MarqueeShortcutsOptions {
  keyboard: Pick<Keyboard, "bind">;
  world: VoxelWorld;
  tool: ToolStore;
  selection: Pick<SelectionStore, "voxelLayer">;
  placement: Pick<
    MapPlacement,
    "current" | "lifted" | "commit" | "liftRegion" | "deleteRegion"
  >;
}

export function bindMarqueeShortcuts(
  options: MarqueeShortcutsOptions
): () => void {
  const {
    keyboard,
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

  const releases = [
    keyboard.bind(
      MARQUEE_SHORTCUTS.delete,
      () => placement.deleteRegion()
    ),
    keyboard.bind(MARQUEE_SHORTCUTS.selectLayer, selectLayer)
  ];

  return () => {
    for (const release of releases) {
      release();
    }
  };
}
