// Import Third-party Dependencies
import {
  KeyBindingSettings,
  type KeyBindingSettingsOptions
} from "@jolly-pixel/controls";

// Import Internal Dependencies
import {
  PIXEL_ART_KEY_BINDINGS,
  type PixelArtAction
} from "./PixelArtKeyBindings.ts";

// CONSTANTS
export const KEY_BINDINGS_STORAGE_KEY = "pixel-art:keybindings";

export type PixelArtKeyBindingSettingsOptions = Omit<
  KeyBindingSettingsOptions<PixelArtAction>,
  "defaults" | "storageKey"
>;

export class PixelArtKeyBindingSettings
  extends KeyBindingSettings<PixelArtAction> {
  constructor(
    options: PixelArtKeyBindingSettingsOptions
  ) {
    super({
      ...options,
      defaults: PIXEL_ART_KEY_BINDINGS,
      storageKey: KEY_BINDINGS_STORAGE_KEY
    });
  }
}
