// Import Third-party Dependencies
import type {
  Keyboard,
  KeyChordString
} from "@jolly-pixel/controls";
import type { VoxelCoord } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { MapPlacement } from "./MapPlacement.ts";

export const CLIPBOARD_SHORTCUTS = {
  copy: ["Mod+c"],
  paste: ["Mod+v"]
} as const satisfies Record<string, readonly KeyChordString[]>;

export interface ClipboardShortcutsOptions {
  keyboard: Pick<Keyboard, "bind">;
  placement: Pick<MapPlacement, "copy" | "paste">;
  aimPoint: () => VoxelCoord;
}

export function bindClipboardShortcuts(
  options: ClipboardShortcutsOptions
): () => void {
  const {
    keyboard,
    placement,
    aimPoint
  } = options;
  const releases = [
    keyboard.bind(CLIPBOARD_SHORTCUTS.copy, () => placement.copy()),
    keyboard.bind(
      CLIPBOARD_SHORTCUTS.paste,
      () => placement.paste(aimPoint())
    )
  ];

  return () => {
    for (const release of releases) {
      release();
    }
  };
}
