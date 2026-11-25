// Import Third-party Dependencies
import { defineCapabilities } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { ScriptCommand } from "../network/types.ts";

// CONSTANTS
export const SCRIPT_CAPABILITIES = defineCapabilities<ScriptCommand["action"]>()([
  {
    name: "text",
    label: "Text",
    events: ["edited"]
  }
]);
