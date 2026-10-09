// Import Third-party Dependencies
import type { AnimationInterpolation } from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import type { KeyEditor } from "../keys/KeyEditor.ts";
import { INTERPOLATION_OPTIONS } from "../keys/interpolation.ts";
import {
  menuSession,
  type MenuEntry,
  type MenuSession
} from "../../../shared/menuSession.ts";
import { DELETE_ITEM } from "../../../shared/menuItems.ts";

type KeyAction =
  | AnimationInterpolation
  | "copy"
  | "delete";

export function keyMenu(
  keys: KeyEditor
): MenuSession {
  const current = keys.interpolation;
  const items: MenuEntry<KeyAction>[] = [
    {
      id: "interpolation",
      label: "Interpolation",
      items: INTERPOLATION_OPTIONS.map(({ value, label }) => {
        return {
          id: value,
          label,
          disabled: value === current
        };
      })
    },
    {
      id: "copy",
      label: "Copy"
    },
    "separator",
    DELETE_ITEM
  ];

  return menuSession(items, (action) => runKeyAction(keys, action));
}

function runKeyAction(
  keys: KeyEditor,
  action: KeyAction
): void {
  switch (action) {
    case "copy":
      keys.copy();
      break;
    case "delete":
      keys.remove();
      break;
    default:
      keys.setInterpolation(action);
      break;
  }
}
