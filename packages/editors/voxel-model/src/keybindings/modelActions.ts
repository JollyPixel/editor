// Import Third-party Dependencies
import type { KeyBindingDefaults } from "@jolly-pixel/controls";

export const MODEL_KEY_BINDINGS = Object.freeze({
  "edit.undo": "Mod+z",
  "edit.redo": ["Mod+y", "Mod+Shift+z"],
  "animation.key": "k"
} as const satisfies KeyBindingDefaults<string>);

export type ModelAction = keyof typeof MODEL_KEY_BINDINGS;
