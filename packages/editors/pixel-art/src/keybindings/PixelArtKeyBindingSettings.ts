// Import Third-party Dependencies
import {
  KeyBindingSettings,
  type KeyBindingSettingsOptions
} from "@jolly-pixel/controls";
import {
  followKeyBindings,
  type Preferences
} from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import {
  PIXEL_ART_KEY_BINDINGS,
  type PixelArtAction
} from "./PixelArtKeyBindings.ts";
import { PIXEL_ART_KEYBINDINGS } from "../preferences.ts";

export type PixelArtKeyBindingSettingsOptions = Omit<
  KeyBindingSettingsOptions<PixelArtAction>,
  "defaults"
>;

export class PixelArtKeyBindingSettings
  extends KeyBindingSettings<PixelArtAction> {
  static follow(
    preferences: Preferences,
    onDropped?: (message: string) => void
  ): PixelArtKeyBindingSettings {
    const settings = new PixelArtKeyBindingSettings({ onDropped });
    followKeyBindings(settings, preferences, PIXEL_ART_KEYBINDINGS);

    return settings;
  }

  constructor(
    options: PixelArtKeyBindingSettingsOptions = {}
  ) {
    super({
      ...options,
      defaults: PIXEL_ART_KEY_BINDINGS
    });
  }
}
