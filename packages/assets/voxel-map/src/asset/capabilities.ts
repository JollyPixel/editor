// Import Third-party Dependencies
import { defineCapabilities } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import type { BlocksetDocumentNetworkCommand } from "../network/blockset/types.ts";
import type { VoxelMapNetworkCommand } from "../network/voxelMap/types.ts";

// CONSTANTS
export const VOXEL_MAP_CAPABILITIES = defineCapabilities<
  VoxelMapNetworkCommand["action"]
>()([
  {
    name: "voxels",
    label: "Voxels",
    events: [
      "voxel-set",
      "voxel-removed",
      "voxels-set",
      "voxels-removed",
      "voxels-patched"
    ]
  },
  {
    name: "layers",
    label: "Layers",
    events: [
      "added",
      "removed",
      "updated",
      "cloned",
      "merged",
      "position-updated",
      "position-rebased",
      "layer-transformed",
      "layer-moved",
      "object-layer-added",
      "object-layer-removed",
      "object-layer-updated",
      "world-replace"
    ]
  },
  {
    name: "objects",
    label: "Objects",
    events: [
      "object-added",
      "object-removed",
      "object-moved",
      "object-updated"
    ]
  },
  {
    name: "templates",
    label: "Templates",
    events: [
      "template-defined",
      "template-updated",
      "template-removed"
    ]
  },
  {
    name: "blocksets",
    label: "Blocksets",
    events: [
      "blockset-added",
      "blockset-removed"
    ]
  }
]);

export const BLOCKSET_CAPABILITIES = defineCapabilities<
  BlocksetDocumentNetworkCommand["action"]
>()([
  {
    name: "blocks",
    label: "Blocks",
    events: [
      "block-defined",
      "block-removed",
      "block-moved"
    ]
  },
  {
    name: "materials",
    label: "Materials",
    events: [
      "material-group-defined",
      "material-group-removed",
      "material-group-renamed",
      "blend-group-defined",
      "blend-group-removed"
    ]
  },
  {
    name: "tileSize",
    label: "Tile size",
    events: [
      "tile-size-updated"
    ]
  }
]);
