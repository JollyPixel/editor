// Import Third-party Dependencies
import { REPLAY_TOUR_STEP } from "@jolly-pixel/editor.host";
import { Tour } from "@jolly-pixel/lantern";

// Import Internal Dependencies
import { TourHooks } from "./support/TourHooks.ts";

// CONSTANTS
const kUv = TourHooks.textureMode("uv");

export const uvBlocksets = new Tour({
  id: "voxel-map.uv-blocksets",
  version: 1,
  title: "UVs and blocksets",
  steps: [
    {
      id: "welcome",
      title: "UVs and blocksets",
      body: "Each block shows a region of a blockset texture. " +
        "This tour covers blocksets, block regions and block settings."
    },
    {
      id: "tabs",
      target: TourHooks.texture("[part=texture-tabs]"),
      side: "right",
      title: "Blocksets",
      body: "Each tab is a blockset, and picking a block opens its blockset. " +
        "Double click a tab, or press `F2` on it, to rename the blockset, " +
        "change its tile size or remove it.",
      enter: TourHooks.showPane("blocks")
    },
    {
      id: "add",
      target: TourHooks.texture("[part=texture-add]"),
      side: "right",
      title: "Add a blockset",
      body: "Start a new texture with its own tile size, or link a texture that already exists.",
      when: TourHooks.finds(["texture-editor", "pixel-draw-panel", "[part=texture-add]"]),
      enter: TourHooks.showPane("blocks")
    },
    {
      id: "line-tabs",
      target: TourHooks.texture("[part=line-tabs-toggle]"),
      side: "right",
      title: "Compact tabs",
      body: "Short on room? This turns the tabs into a thin bar.",
      enter: TourHooks.showPane("blocks")
    },
    {
      id: "uv-tool",
      target: TourHooks.texture("mode-rail"),
      side: "right",
      title: "UV tool",
      body: "The UV tool outlines the region of each block. " +
        "Click a region to pick its block, and picking a block in the library selects its region.",
      enter: kUv
    },
    {
      id: "move",
      target: TourHooks.texture("[part=stage]"),
      side: "right",
      title: "Move a region",
      body: "Drag a region to change what its block shows. It snaps to the grid: " +
        "hold `Alt` to place it freely. The map updates when you drop it.\n\n" +
        "Set `texture.uvSync` to `live` in the console to update it while you drag.",
      enter: kUv
    },
    {
      id: "states",
      target: TourHooks.texture("[part=top-row]"),
      side: "below",
      title: "Region layout",
      body: "With a region selected, this bar sets how its faces are laid out: " +
        "Stacked shares one tile between every face, Unfolded spreads them out, " +
        "and Free moves each face on its own.\n\n" +
        "Unfold with picks a layout, and Edit nets lets you design your own.",
      enter: kUv
    },
    {
      id: "rotate",
      target: TourHooks.texture("[part=top-row]"),
      side: "below",
      title: "Rotate",
      body: "The rotate buttons, `{pixelart.rotate}` and `{pixelart.rotateCounterClockwise}` " +
        "turn the selected region, or the selected face of a Free region, by a quarter.",
      enter: kUv
    },
    {
      id: "edit-block",
      target: ["blocks-panel", "jolly-folder[key=block-library]"],
      side: "right",
      title: "Block settings",
      body: "Double click a block to change its name, shape and region size.\n\n" +
        "A block with transparent pixels also gets Transparency settings: " +
        "cut out or blended, drawn from one side or both.",
      enter: TourHooks.showPane("blocks")
    },
    {
      id: "library",
      target: ["blocks-panel", "block-library-settings"],
      side: "right",
      title: "Library settings",
      body: "Sort blocks by use, or show only the blocks of the active blockset. " +
        "The search box filters them by name, and you can drag a block to reorder the library.",
      enter: TourHooks.showPane("blocks")
    },
    REPLAY_TOUR_STEP
  ]
});
