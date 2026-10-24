// Import Third-party Dependencies
import { REPLAY_TOUR_STEP } from "@jolly-pixel/editor.host";
import { Tour } from "@jolly-pixel/lantern";

// Import Internal Dependencies
import { painting } from "./painting.ts";
import { TourHooks } from "./support/TourHooks.ts";

// CONSTANTS
const kCanAddBlocks = TourHooks.when(
  (editing) => editing.blocksets.entriesGranting("blocks").length > 0
);
const kCanBuild = TourHooks.when(
  (editing) => editing.access.current.has("voxels")
);

export const firstBlock = new Tour({
  id: "voxel-map.first-block",
  version: 1,
  title: "Your first block",
  steps: [
    {
      id: "welcome",
      title: "Your first block",
      body: "A block takes its faces from a tile of the blockset texture.\n\n" +
        "In this tour you paint a tile, turn it into a block and build with it."
    },
    {
      id: "texture",
      target: TourHooks.texture("[part=stage]"),
      side: "right",
      title: "The blockset texture",
      body: "This is the blockset texture. It is cut into square tiles, " +
        "and each block shows one of them, or several for a block with different faces.",
      enter: TourHooks.textureMode("paint")
    },
    {
      id: "paint",
      target: TourHooks.texture("[part=stage]"),
      side: "right",
      title: "Paint a tile",
      body: "Paint in an empty tile. Left click uses the first color of the rail, " +
        "right click the second one, and the wheel zooms.\n\n" +
        "The tour goes on once you have drawn.",
      when: kCanAddBlocks,
      enter: TourHooks.textureMode("paint"),
      until: TourHooks.until((_editing, done, tour) => {
        const pixels = tour.texturePanel?.canvasManager?.document;
        pixels?.on("draw-end", done);

        return () => pixels?.off("draw-end", done);
      })
    },
    {
      id: "add-block",
      target: ["blocks-panel", "block-library", "block-library-viewport", "button.add-cell"],
      side: "right",
      title: "Add a block",
      body: "Click this tile to add a block. Pick its shape, then press Create.",
      when: kCanAddBlocks,
      enter: TourHooks.showPane("blocks"),
      until: TourHooks.until((editing, done) => editing.editorMap.subscribe(
        "blockRegistryChanged",
        (change) => {
          if (change === "added") {
            done();
          }
        }
      ))
    },
    {
      id: "faces",
      target: TourHooks.texture("[part=stage]"),
      side: "right",
      title: "Its faces",
      body: "The UV tool outlines the region of each block. " +
        "Drag the new block's region onto the tile you painted: the block shows what lies under it.",
      when: kCanAddBlocks,
      enter: TourHooks.textureMode("uv")
    },
    {
      id: "place",
      target: ["#game-container"],
      side: "left",
      title: "Build with it",
      body: "The new block is picked in the library and the brush is ready. " +
        "Left click on the grid to place the block.",
      when: kCanBuild,
      enter: TourHooks.build(),
      until: TourHooks.until((editing, done) => editing.editorMap.subscribe(
        "layerUpdated",
        (command) => {
          if (command.action === "voxel-set" || command.action === "voxels-set") {
            done();
          }
        }
      ))
    },
    REPLAY_TOUR_STEP
  ],
  followUp: painting
});
