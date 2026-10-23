// Import Third-party Dependencies
import type {
  KeyBindingHandler,
  KeyBindingSettings,
  KeyBindingTarget,
  KeyChordString
} from "@jolly-pixel/controls";
import type { VoxelTransformOptions } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { MapPlacement } from "./MapPlacement.ts";
import {
  PLACEMENT_MIRRORS,
  PLACEMENT_ROTATIONS
} from "./placementTransforms.ts";
import type { HorizontalAxis } from "../../scene/camera/EditorCamera.ts";
import type {
  MapAction,
  MapGroupAction
} from "../../keybindings/mapActions.ts";

export const PLACEMENT_SHORTCUTS = {
  commit: ["Enter", "NumpadEnter"],
  cancel: ["Escape"]
} as const satisfies Record<string, readonly KeyChordString[]>;

export interface PlacementShortcutsOptions {
  keyboard: KeyBindingTarget;
  keyBindings: Pick<KeyBindingSettings<MapAction>, "bind">;
  placement: Pick<MapPlacement, "placing" | "turn" | "commit" | "cancel">;
  rightAxis: () => HorizontalAxis;
}

export function bindPlacementShortcuts(
  options: PlacementShortcutsOptions
): () => void {
  const {
    keyboard,
    keyBindings,
    placement,
    rightAxis
  } = options;

  function turn(
    transform: VoxelTransformOptions | undefined
  ): boolean {
    if (!placement.placing || transform === undefined) {
      return false;
    }
    placement.turn(transform);

    return true;
  }

  const orient: Partial<Record<MapGroupAction<"orient">, KeyBindingHandler>> = {
    "orient.mirrorHorizontal": () => turn(
      PLACEMENT_MIRRORS.find((mirror) => mirror.axis === rightAxis())?.transform
    )
  };
  for (const { action, transform } of [
    ...PLACEMENT_ROTATIONS,
    ...PLACEMENT_MIRRORS
  ]) {
    if (action !== undefined) {
      orient[action] = () => turn(transform);
    }
  }

  const releases = [
    keyBindings.bind(keyboard, orient, { priority: 1 }),
    keyboard.bind(PLACEMENT_SHORTCUTS.commit, (event) => {
      if (!placement.placing || pressesButton(event)) {
        return false;
      }
      placement.commit();

      return true;
    }),
    keyboard.bind(
      PLACEMENT_SHORTCUTS.cancel,
      () => placement.cancel(),
      { priority: 1 }
    )
  ];

  return () => {
    for (const release of releases) {
      release();
    }
  };
}

function pressesButton(
  event: KeyboardEvent
): boolean {
  return event.composedPath().some(
    (target) => target instanceof HTMLButtonElement
  );
}
