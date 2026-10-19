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
  MAP_KEY_BINDINGS,
  type MapAction
} from "./mapActions.ts";
import { VOXEL_MAP_KEYBINDINGS } from "../preferences.ts";

export * from "./mapActions.ts";

export type MapKeyBindingSettingsOptions = Omit<
  KeyBindingSettingsOptions<MapAction>,
  "defaults"
>;

export class MapKeyBindingSettings extends KeyBindingSettings<MapAction> {
  static follow(
    preferences: Preferences,
    onDropped?: (message: string) => void
  ): MapKeyBindingSettings {
    const settings = new MapKeyBindingSettings({ onDropped });
    followKeyBindings(settings, preferences, VOXEL_MAP_KEYBINDINGS);

    return settings;
  }

  constructor(
    options: MapKeyBindingSettingsOptions = {}
  ) {
    super({
      ...options,
      defaults: MAP_KEY_BINDINGS
    });
  }
}
