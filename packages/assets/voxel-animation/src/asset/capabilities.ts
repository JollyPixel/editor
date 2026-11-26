// Import Third-party Dependencies
import { defineCapabilities } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { AnimationCommandAction } from "../network/types.ts";

// CONSTANTS
export const VOXEL_ANIMATION_CAPABILITIES = defineCapabilities<AnimationCommandAction>()([
  {
    name: "clips",
    label: "Clips",
    events: [
      "rig-renamed",
      "clip-added",
      "clip-removed",
      "clip-changed",
      "clip-moved",
      "key-set",
      "key-removed",
      "track-removed",
      "track-renamed"
    ]
  }
]);
