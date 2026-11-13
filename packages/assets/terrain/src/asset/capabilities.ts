// Import Third-party Dependencies
import { defineCapabilities } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { TerrainCommandAction } from "../network/types.ts";

// CONSTANTS
export const TERRAIN_CAPABILITIES = defineCapabilities<TerrainCommandAction>()([
  {
    name: "heights",
    label: "Heights",
    events: [
      "heights-patched"
    ]
  },
  {
    name: "paint",
    label: "Paint",
    events: [
      "splat-patched"
    ]
  },
  {
    name: "holes",
    label: "Holes",
    events: [
      "holes-patched"
    ]
  },
  {
    name: "chunks",
    label: "Chunks",
    events: [
      "chunk-added",
      "chunk-removed",
      "tier-changed"
    ]
  },
  {
    name: "materials",
    label: "Materials",
    events: [
      "material-added",
      "material-updated",
      "material-removed",
      "texture-size-changed"
    ]
  },
  {
    name: "pointsOfInterest",
    label: "Points of interest",
    events: [
      "poi-added",
      "poi-updated",
      "poi-removed"
    ]
  }
]);
