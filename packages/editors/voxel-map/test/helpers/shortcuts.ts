// Import Third-party Dependencies
import { MemoryStorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { MapKeyBindingSettings } from "../../src/keybindings/MapKeyBindings.ts";

export function defaultKeyBindings(): MapKeyBindingSettings {
  return new MapKeyBindingSettings({
    storage: new MemoryStorageAdapter()
  });
}
