// Import Third-party Dependencies
import type { UvNetPresetInit } from "@jolly-pixel/editor.pixel-art";

// CONSTANTS
const kSides = ["front", "back", "left", "right"];

export const BLOCK_UV_NETS: readonly UvNetPresetInit[] = Object.freeze([
  {
    id: "voxel-map:caps-sides",
    name: "Top/bottom + sides",
    rows: [[["top", "bottom"], kSides]]
  },
  {
    id: "voxel-map:top-sides-bottom",
    name: "Top / sides / bottom",
    rows: [["top"], [kSides], ["bottom"]]
  }
]);

export const DEFAULT_BLOCK_UV_NET = BLOCK_UV_NETS[0].id;
