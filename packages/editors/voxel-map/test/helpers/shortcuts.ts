// Import Third-party Dependencies
import { KeyBindingSettings } from "@jolly-pixel/controls";

// Import Internal Dependencies
import {
  MAP_KEY_BINDINGS,
  type MapAction
} from "../../src/keybindings/mapActions.ts";

export function defaultKeyBindings(): KeyBindingSettings<MapAction> {
  return new KeyBindingSettings({ defaults: MAP_KEY_BINDINGS });
}
