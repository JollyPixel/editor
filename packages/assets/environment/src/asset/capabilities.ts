// Import Third-party Dependencies
import { defineCapabilities } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { EnvironmentCommand } from "../network/types.ts";

// CONSTANTS
export const ENVIRONMENT_CAPABILITIES = defineCapabilities<EnvironmentCommand["action"]>()([
  {
    name: "settings",
    label: "Settings",
    events: ["environment-changed"]
  }
]);
