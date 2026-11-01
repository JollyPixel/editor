// Import Third-party Dependencies
import {
  PIXEL_ART_KEYBINDINGS,
  PIXEL_ART_PREFERENCES
} from "@jolly-pixel/editor.pixel-art/preferences";
import {
  defineKeyBindings,
  definePreferences,
  type PreferenceValues
} from "@jolly-pixel/preferences";

// Import Internal Dependencies
import { MAP_KEY_BINDINGS } from "./keybindings/mapActions.ts";

export const VOXEL_MAP_PREFERENCES = definePreferences({
  name: "voxel-map",
  label: "Voxel map",
  fields: {
    lighting: {
      type: "enum",
      label: "Lighting",
      group: "View",
      options: [
        {
          value: "flat",
          label: "Flat"
        },
        {
          value: "studio",
          label: "Studio"
        },
        {
          value: "day",
          label: "Day"
        },
        {
          value: "night",
          label: "Night"
        }
      ],
      default: "studio"
    },
    shadows: {
      type: "boolean",
      label: "Shadows",
      group: "View",
      default: false
    },
    ambientOcclusion: {
      type: "boolean",
      label: "Ambient occlusion",
      group: "View",
      default: false
    },
    blockLight: {
      type: "boolean",
      label: "Block light",
      group: "View",
      default: true
    },
    glow: {
      type: "boolean",
      label: "Glow",
      group: "View",
      default: true
    },
    reflections: {
      type: "boolean",
      label: "Reflections",
      group: "View",
      default: false
    },
    grid: {
      type: "boolean",
      label: "Grid",
      group: "View",
      default: true
    },
    chunkBounds: {
      type: "boolean",
      label: "Chunk bounds",
      group: "View",
      default: false
    },
    inspector: {
      type: "enum",
      label: "Voxel inspector",
      group: "View",
      options: [
        {
          value: "off",
          label: "Off"
        },
        {
          value: "overlay",
          label: "Overlay"
        },
        {
          value: "wireframe",
          label: "Wireframe"
        }
      ],
      default: "off"
    },
    uvSync: {
      type: "enum",
      label: "UV sync",
      group: "Textures",
      description: "Live rewrites the blocks while a UV is dragged, commit only once it is dropped",
      options: [
        {
          value: "live",
          label: "Live"
        },
        {
          value: "commit",
          label: "Commit"
        }
      ],
      default: "commit"
    }
  }
});

export type VoxelMapPreferences = PreferenceValues<
  typeof VOXEL_MAP_PREFERENCES.fields
>;

export const VOXEL_MAP_KEYBINDINGS = defineKeyBindings({
  name: "voxel-map-keybindings",
  label: "Voxel map",
  defaults: MAP_KEY_BINDINGS,
  actions: {
    "tool.brush": {
      label: "Brush tool",
      group: "Tools"
    },
    "tool.select": {
      label: "Select tool",
      group: "Tools"
    },
    "edit.undo": {
      label: "Undo",
      group: "Editing"
    },
    "edit.redo": {
      label: "Redo",
      group: "Editing"
    },
    "edit.copy": {
      label: "Copy",
      group: "Editing"
    },
    "edit.cut": {
      label: "Cut",
      group: "Editing"
    },
    "edit.paste": {
      label: "Paste",
      group: "Editing"
    },
    "edit.delete": {
      label: "Delete the selection",
      group: "Editing"
    },
    "edit.selectLayer": {
      label: "Select the whole layer",
      group: "Editing"
    },
    "brush.mode": {
      label: "Switch between build and replace",
      group: "Brush"
    },
    "brush.pattern": {
      label: "Switch between square and circle",
      group: "Brush"
    },
    "brush.ghost": {
      label: "Show or hide the ghost block",
      group: "Brush"
    },
    "brush.shrink": {
      label: "Shrink the brush",
      group: "Brush"
    },
    "brush.grow": {
      label: "Grow the brush",
      group: "Brush"
    },
    "orient.rotateCounterClockwise": {
      label: "Rotate counterclockwise",
      group: "Orientation"
    },
    "orient.rotateClockwise": {
      label: "Rotate clockwise",
      group: "Orientation"
    },
    "orient.flipVertical": {
      label: "Flip upside down",
      group: "Orientation"
    },
    "orient.mirrorHorizontal": {
      label: "Mirror horizontally",
      group: "Orientation"
    },
    "orient.autoRotation": {
      label: "Orient to the face",
      group: "Orientation"
    },
    "view.frame": {
      label: "Frame the selection",
      group: "View"
    },
    "view.grid": {
      label: "Show or hide the grid",
      group: "View"
    },
    "view.glow": {
      label: "Turn glow on or off",
      group: "View"
    },
    "view.chunkBounds": {
      label: "Show or hide chunk bounds",
      group: "View"
    },
    "view.inspector": {
      label: "Cycle the voxel inspector",
      group: "View"
    }
  }
});

export const shared = [PIXEL_ART_PREFERENCES, PIXEL_ART_KEYBINDINGS];

export default [VOXEL_MAP_PREFERENCES, VOXEL_MAP_KEYBINDINGS];
