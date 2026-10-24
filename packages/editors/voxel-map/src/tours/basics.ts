// Import Third-party Dependencies
import { REPLAY_TOUR_STEP } from "@jolly-pixel/editor.host";
import { Tour } from "@jolly-pixel/lantern";

// Import Internal Dependencies
import { firstBlock } from "./firstBlock.ts";
import { TourHooks } from "./support/TourHooks.ts";

export const basics = new Tour({
  id: "voxel-map.basics",
  version: 2,
  title: "Voxel map basics",
  steps: [
    {
      id: "welcome",
      title: "Welcome",
      body: "This editor builds maps out of blocks placed on layers.\n\n" +
        "The tour takes about a minute. Press `Esc` to leave it."
    },
    {
      id: "camera",
      target: ["#game-container"],
      side: "left",
      title: "Moving around",
      body: "`{camera.forward}` `{camera.left}` `{camera.back}` `{camera.right}` fly, " +
        "`{camera.up}` and `{camera.down}` go up and down, and the wheel changes the speed.\n\n" +
        "Drag with the middle button, or hold `Alt` and drag, to look around. " +
        "`Alt` + click orbits around a point and `Esc` flies free again."
    },
    {
      id: "block-library",
      target: ["blocks-panel", "jolly-folder[key=block-library]"],
      side: "right",
      title: "Block library",
      body: "Pick the block you want to build with. " +
        "Double click a block to edit it, or right click it for more actions. " +
        "The tile after the last block adds a new one.",
      enter: TourHooks.showPane("blocks")
    },
    {
      id: "orientation",
      target: ["blocks-panel", "brush-orientation"],
      side: "right",
      title: "Orientation",
      body: "Rotation and Flip Y set how the next blocks are turned. " +
        "`{map.orient.rotateCounterClockwise}` and `{map.orient.rotateClockwise}` turn them, " +
        "`{map.orient.flipVertical}` flips them and `{map.orient.autoRotation}` " +
        "makes them follow the camera again.",
      enter: TourHooks.showPane("blocks")
    },
    {
      id: "building",
      target: ["#game-container"],
      side: "left",
      title: "Building",
      body: "Left click builds with the picked block and right click erases. " +
        "Hold the left button and move to build a line.\n\n" +
        "`Ctrl` + click picks the block under the cursor."
    },
    {
      id: "brush",
      target: ["voxel-edit-toolbar", "voxel-brush-controls"],
      side: "above",
      title: "Brush",
      body: "`{map.brush.shrink}` and `{map.brush.grow}` resize the brush, and so does `Ctrl` + wheel. " +
        "`{map.brush.mode}` switches between Build and Replace, " +
        "`{map.brush.pattern}` between a square and a circle, " +
        "and `{map.brush.ghost}` previews the block before you place it."
    },
    {
      id: "tools",
      target: ["voxel-edit-toolbar"],
      side: "above",
      title: "Tools",
      body: "The brush (`{map.tool.brush}`) builds. " +
        "Selection (`{map.tool.select}`) grabs blocks to move, copy or save as a template. " +
        "`{map.view.frame}` frames the selected layer.\n\n" +
        "The numbers on Undo and Redo count the steps left."
    },
    {
      id: "panes",
      target: () => document
        .querySelector("jolly-pane[key=blocks]")
        ?.closest("jolly-pane-group")
        ?.shadowRoot
        ?.querySelector("[part=tabs]") ?? null,
      side: "right",
      title: "Panels",
      body: "Blocks, Materials, Paint and Layers each have a tour of their own. " +
        "Drag a tab to move its panel, or drop it on the other side of the view."
    },
    {
      id: "console",
      title: "Every command",
      body: "Press `Ctrl+K` to open the console. It lists every command and setting of the editor."
    },
    {
      ...REPLAY_TOUR_STEP,
      body: "Every tour of this editor is listed here."
    }
  ],
  followUp: firstBlock
});
