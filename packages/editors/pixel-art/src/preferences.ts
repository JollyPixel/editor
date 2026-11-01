// Import Third-party Dependencies
import {
  defineKeyBindings,
  definePreferences,
  type PreferenceValues
} from "@jolly-pixel/preferences";

// Import Internal Dependencies
import { PIXEL_ART_KEY_BINDINGS } from "./keybindings/PixelArtKeyBindings.ts";

export const PIXEL_ART_PREFERENCES = definePreferences({
  name: "pixel-art",
  label: "Pixel art",
  fields: {
    showGrid: {
      type: "boolean",
      label: "Grid",
      group: "Canvas",
      default: false
    },
    gridSize: {
      type: "range",
      label: "Grid size",
      group: "Canvas",
      min: 1,
      max: 256,
      default: 16
    },
    snapToGrid: {
      type: "boolean",
      label: "Snap UVs to the grid",
      group: "Canvas",
      default: false
    },
    showAll: {
      type: "boolean",
      label: "Every UV region",
      group: "UV regions",
      description: "Shows the regions of every face, not only the selected ones",
      default: false
    },
    showRegionLabels: {
      type: "boolean",
      label: "Region labels",
      group: "UV regions",
      default: false
    },
    showSizeLabels: {
      type: "boolean",
      label: "Size labels",
      group: "UV regions",
      default: false
    }
  }
});

export type PixelArtPreferences = PreferenceValues<
  typeof PIXEL_ART_PREFERENCES.fields
>;

export const PIXEL_ART_KEYBINDINGS = defineKeyBindings({
  name: "pixel-art-keybindings",
  label: "Pixel art",
  defaults: PIXEL_ART_KEY_BINDINGS,
  actions: {
    selectAll: {
      label: "Select all",
      group: "Editing"
    },
    copy: {
      label: "Copy",
      group: "Editing"
    },
    paste: {
      label: "Paste",
      group: "Editing"
    },
    undo: {
      label: "Undo",
      group: "Editing"
    },
    redo: {
      label: "Redo",
      group: "Editing"
    },
    delete: {
      label: "Delete the selection",
      group: "Editing"
    },
    rotate: {
      label: "Rotate clockwise",
      group: "Transform"
    },
    rotateCounterClockwise: {
      label: "Rotate counterclockwise",
      group: "Transform"
    },
    flipHorizontal: {
      label: "Flip horizontally",
      group: "Transform"
    },
    flipVertical: {
      label: "Flip vertically",
      group: "Transform"
    }
  }
});

export default [PIXEL_ART_PREFERENCES, PIXEL_ART_KEYBINDINGS];
