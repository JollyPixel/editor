// Import Third-party Dependencies
import { defineKeyBindings } from "@jolly-pixel/preferences";

// CONSTANTS
export const ENVIRONMENT_KEY_BINDINGS = Object.freeze({
  "edit.undo": "Mod+z",
  "edit.redo": ["Mod+y", "Mod+Shift+z"]
} as const);

export const ENVIRONMENT_KEYBINDINGS = defineKeyBindings({
  name: "environment-keybindings",
  label: "Environment",
  defaults: ENVIRONMENT_KEY_BINDINGS,
  actions: {
    "edit.undo": {
      label: "Undo",
      group: "Editing"
    },
    "edit.redo": {
      label: "Redo",
      group: "Editing"
    }
  }
});

export default [ENVIRONMENT_KEYBINDINGS];
