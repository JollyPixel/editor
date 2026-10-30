// Import Third-party Dependencies
import type { KeyBindingDefaults } from "@jolly-pixel/controls";

export const TERRAIN_KEY_BINDINGS = Object.freeze({
  "edit.undo": "Mod+z",
  "edit.redo": ["Mod+y", "Mod+Shift+z"]
} as const satisfies KeyBindingDefaults<string>);

export type TerrainAction = keyof typeof TERRAIN_KEY_BINDINGS;
