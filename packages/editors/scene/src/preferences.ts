// Import Third-party Dependencies
import {
  defineKeyBindings,
  definePreferences,
  type PreferenceValues
} from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import { SCENE_KEY_BINDINGS } from "./keybindings/sceneActions.ts";

export const SCENE_PREFERENCES = definePreferences({
  name: "scene",
  label: "Scene",
  fields: {
    grid: {
      type: "boolean",
      label: "Grid",
      group: "View",
      default: true
    },
    axes: {
      type: "boolean",
      label: "Axes",
      group: "View",
      default: true
    },
    snap: {
      type: "boolean",
      label: "Snap",
      group: "Snapping",
      description: "Hold Alt while dragging to move freely",
      default: false
    },
    snapTo: {
      type: "enum",
      label: "Snap to",
      group: "Snapping",
      description: "Corner-origin content keeps its corner on grid lines",
      options: [
        {
          value: "cells",
          label: "Cell centers"
        },
        {
          value: "lines",
          label: "Grid lines"
        }
      ],
      default: "cells"
    },
    snapMove: {
      type: "range",
      label: "Move step",
      group: "Snapping",
      description: "World units; positions land on multiples of it",
      min: 0.05,
      max: 10,
      step: 0.05,
      default: 1
    },
    snapRotate: {
      type: "range",
      label: "Rotate step",
      group: "Snapping",
      description: "Degrees, counted from the starting angle",
      min: 1,
      max: 90,
      step: 1,
      default: 15
    },
    snapScale: {
      type: "range",
      label: "Scale step",
      group: "Snapping",
      min: 0.05,
      max: 2,
      step: 0.05,
      default: 0.1
    }
  }
});

export type ScenePreferences = PreferenceValues<
  typeof SCENE_PREFERENCES.fields
>;

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
    "gizmo.snap": {
      label: "Toggle snapping",
      group: "Gizmo"
    },
    "view.frame": {
      label: "Frame the selection",
      group: "View"
    }
  }
});

export default [SCENE_PREFERENCES, SCENE_KEYBINDINGS];
