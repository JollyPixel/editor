// Import Third-party Dependencies
import { defineKeyBindings } from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import { SCENE_KEY_BINDINGS } from "./keybindings/sceneActions.ts";

export const SCENE_KEYBINDINGS = defineKeyBindings({
  name: "scene-keybindings",
  label: "Scene",
  defaults: SCENE_KEY_BINDINGS,
  actions: {
    "edit.undo": {
      label: "Undo",
      group: "Editing"
    },
    "edit.redo": {
      label: "Redo",
      group: "Editing"
    },
    "edit.duplicate": {
      label: "Duplicate the selection",
      group: "Editing"
    },
    "edit.delete": {
      label: "Delete the selection",
      group: "Editing"
    },
    "gizmo.translate": {
      label: "Move",
      group: "Gizmo"
    },
    "gizmo.rotate": {
      label: "Rotate",
      group: "Gizmo"
    },
    "gizmo.scale": {
      label: "Scale",
      group: "Gizmo"
    },
    "gizmo.space": {
      label: "Toggle local and world axes",
      group: "Gizmo"
    },
    "view.frame": {
      label: "Frame the selection",
      group: "View"
    }
  }
});

export default [SCENE_KEYBINDINGS];
