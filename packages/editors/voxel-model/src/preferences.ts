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
import { MODEL_KEY_BINDINGS } from "./keybindings/modelActions.ts";

export const VOXEL_MODEL_PREFERENCES = definePreferences({
  name: "voxel-model",
  label: "Voxel model",
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
    keyLight: {
      type: "enum",
      label: "Key light",
      group: "View",
      options: [
        {
          value: "front-left",
          label: "Front left"
        },
        {
          value: "front-right",
          label: "Front right"
        },
        {
          value: "top",
          label: "Top"
        }
      ],
      default: "front-right"
    },
    background: {
      type: "color",
      label: "Background",
      group: "View",
      description: "Empty follows the lighting",
      default: null
    },
    reflections: {
      type: "boolean",
      label: "Reflections",
      group: "View",
      default: true
    },
    shadows: {
      type: "boolean",
      label: "Shadows",
      group: "View",
      default: false
    },
    glow: {
      type: "boolean",
      label: "Glow",
      group: "View",
      default: true
    }
  }
});

export type VoxelModelPreferences = PreferenceValues<
  typeof VOXEL_MODEL_PREFERENCES.fields
>;

export const VOXEL_MODEL_KEYBINDINGS = defineKeyBindings({
  name: "voxel-model-keybindings",
  label: "Voxel model",
  defaults: MODEL_KEY_BINDINGS,
  actions: {
    "edit.undo": {
      label: "Undo",
      group: "Editing"
    },
    "edit.redo": {
      label: "Redo",
      group: "Editing"
    },
    "animation.key": {
      label: "Key the selected block",
      group: "Animation"
    }
  }
});

export const shared = [PIXEL_ART_PREFERENCES, PIXEL_ART_KEYBINDINGS];

export default [VOXEL_MODEL_PREFERENCES, VOXEL_MODEL_KEYBINDINGS];
