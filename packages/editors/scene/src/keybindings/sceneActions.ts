// Import Third-party Dependencies
import type { KeyBindingDefaults } from "@jolly-pixel/controls";

export const SCENE_KEY_BINDINGS = Object.freeze({
  "edit.undo": "Mod+z",
  "edit.redo": ["Mod+y", "Mod+Shift+z"],
  "edit.duplicate": "Mod+d",
  "edit.delete": ["Delete", "Backspace"],
  "gizmo.translate": "Digit1",
  "gizmo.rotate": "Digit2",
  "gizmo.scale": "Digit3",
  "gizmo.space": "x",
  "gizmo.snap": "g",
  "view.frame": "f"
} as const satisfies KeyBindingDefaults<string>);

export type SceneAction = keyof typeof SCENE_KEY_BINDINGS;
