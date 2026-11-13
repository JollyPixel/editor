// Import Third-party Dependencies
import { defineCapabilities } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { VoxelModelCommandAction } from "../model/types.ts";

// CONSTANTS
export const VOXEL_MODEL_CAPABILITIES = defineCapabilities<VoxelModelCommandAction>()([
  {
    name: "hierarchy",
    label: "Hierarchy",
    events: [
      "node-added",
      "node-removed",
      "node-moved",
      "node-renamed"
    ]
  },
  {
    name: "transforms",
    label: "Transforms",
    events: [
      "node-transformed",
      "node-shape-changed"
    ]
  },
  {
    name: "uv",
    label: "UV",
    events: [
      "node-uv-changed"
    ]
  },
  {
    name: "materials",
    label: "Materials",
    events: [
      "material-added",
      "material-changed",
      "material-folder-added",
      "material-moved",
      "material-removed",
      "material-renamed",
      "node-material-changed"
    ]
  },
  {
    name: "animations",
    label: "Animations",
    events: [
      "animation-set-linked",
      "animation-set-owned",
      "animation-set-unlinked",
      "animation-binding-changed",
      "animation-binding-cleared"
    ]
  }
]);
