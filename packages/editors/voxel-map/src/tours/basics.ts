// Import Third-party Dependencies
import { REPLAY_TOUR_STEP } from "@jolly-pixel/editor.host";
import { Tour } from "@jolly-pixel/lantern";

// Import Internal Dependencies
import { showPane } from "./showPane.ts";
import { textures } from "./textures.ts";

export const basics = new Tour({
  id: "voxel-map.basics",
  version: 1,
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
      body: "`W` `A` `S` `D` fly, `Space` and `Shift` go up and down, and the wheel changes the speed.\n\n" +
        "Drag with the middle button, or hold `Alt` and drag, to look around. " +
        "`Alt` + click orbits around a point and `Esc` flies free again."
    },
    {
      id: "block-library",
      target: ["blocks-panel", "jolly-folder[key=block-library]"],
      side: "right",
      title: "Block library",
      body: "Pick the block you want to place here. " +
        "Rotation and Flip Y set how it is oriented.",
      enter: showPane("blocks")
    },
    {
      id: "building",
      target: ["#game-container"],
      side: "left",
      title: "Building",
      body: "Left click builds with the picked block and right click erases.\n\n" +
        "`Ctrl` + click picks the block under the cursor."
    },
    {
      id: "brush",
      target: ["voxel-edit-toolbar", "voxel-brush-controls"],
      side: "above",
      title: "Brush",
      body: "`[` and `]` resize the brush. " +
        "`R` switches between Build and Replace, `C` between a square and a circle, " +
        "and `G` previews the block before you place it."
    },
    {
      id: "tools",
      target: ["voxel-edit-toolbar"],
      side: "above",
      title: "Tools",
      body: "Switch between the brush (`B`) and selection (`M`). " +
        "Selection grabs a box or every connected block, ready to copy and paste.\n\n" +
        "Undo and redo live here too."
    },
    {
      id: "layers",
      target: ["layers-panel", "layer-manager"],
      side: "right",
      title: "Layers",
      body: "A map is split into layers. The brush paints on the selected voxel layer.\n\n" +
        "Add, clone or merge layers from the buttons above the list.",
      enter: showPane("layers")
    },
    {
      id: "templates",
      target: ["layers-panel", "template-manager"],
      side: "right",
      title: "Templates",
      body: "Save a voxel layer as a template, then place it again anywhere in the map.",
      enter: showPane("layers")
    },
    {
      id: "console",
      title: "Every command",
      body: "Press `Ctrl+K` to open the console. It lists every command and setting of the editor."
    },
    REPLAY_TOUR_STEP
  ],
  followUp: textures
});
