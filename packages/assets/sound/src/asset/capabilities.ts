// Import Third-party Dependencies
import { defineCapabilities } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { SoundCommand } from "../network/types.ts";

// CONSTANTS
export const SOUND_CAPABILITIES = defineCapabilities<SoundCommand["action"]>()([
  {
    name: "settings",
    label: "Settings",
    events: ["sound-settings-changed"]
  }
]);
