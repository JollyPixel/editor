// Import Third-party Dependencies
import { defineKeyBindings } from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import { TERRAIN_KEY_BINDINGS } from "./keybindings/terrainActions.ts";

export const TERRAIN_KEYBINDINGS = defineKeyBindings({
  name: "terrain-keybindings",
  label: "Terrain",
  defaults: TERRAIN_KEY_BINDINGS,
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

export default [TERRAIN_KEYBINDINGS];
