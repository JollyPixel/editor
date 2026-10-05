// Import Third-party Dependencies
import type {
  KeyBindingDefaults,
  KeyBindingMap
} from "@jolly-pixel/controls";

// CONSTANTS
export const PIXEL_ART_KEY_BINDINGS = Object.freeze({
  selectAll: "Mod+a",
  copy: "Mod+c",
  paste: "Mod+v",
  undo: "Mod+z",
  redo: ["Mod+y", "Mod+Shift+z"],
  delete: "Delete",
  rotate: "r",
  rotateCounterClockwise: "Shift+r",
  flipHorizontal: "h",
  flipVertical: "v"
} as const satisfies KeyBindingDefaults<string>);

export type PixelArtAction = keyof typeof PIXEL_ART_KEY_BINDINGS;

export type PixelArtKeyBindings = KeyBindingMap<PixelArtAction>;
