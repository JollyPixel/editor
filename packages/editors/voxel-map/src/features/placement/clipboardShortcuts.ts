// Import Third-party Dependencies
import type { KeyBindingHandlers } from "@jolly-pixel/controls";
import type { VoxelCoord } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { MapPlacement } from "./MapPlacement.ts";

export interface ClipboardShortcutsOptions {
  placement: Pick<MapPlacement, "copy" | "cut" | "paste">;
  aimPoint: () => VoxelCoord;
}

export function clipboardShortcuts(
  options: ClipboardShortcutsOptions
): KeyBindingHandlers<"edit.copy" | "edit.cut" | "edit.paste"> {
  const {
    placement,
    aimPoint
  } = options;

  return {
    "edit.copy": () => placement.copy(),
    "edit.cut": () => placement.cut(),
    "edit.paste": () => placement.paste(aimPoint())
  };
}
