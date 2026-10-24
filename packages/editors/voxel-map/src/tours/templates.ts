// Import Third-party Dependencies
import { REPLAY_TOUR_STEP } from "@jolly-pixel/editor.host";
import { Tour } from "@jolly-pixel/lantern";

// Import Internal Dependencies
import { TourHooks } from "./support/TourHooks.ts";

// CONSTANTS
const kSelectTool = TourHooks.tool("select");
const kShowLayers = TourHooks.showPane("layers");
const kPlacing = TourHooks.when((editing) => editing.placement.current !== null);
const kHasTemplates = TourHooks.when((editing) => editing.editorMap.world.templates.size > 0);

export const templates = new Tour({
  id: "voxel-map.templates",
  version: 1,
  title: "Selection and templates",
  steps: [
    {
      id: "welcome",
      title: "Selection and templates",
      body: "Select blocks to move, copy or delete them, " +
        "or save them as a template to place again anywhere."
    },
    {
      id: "select-modes",
      target: ["voxel-edit-toolbar", "[data-segment=select]"],
      side: "above",
      title: "Select modes",
      body: "Box select drags a box, Corner select takes two clicks, " +
        "and Connected select grabs every block touching the one you click.\n\n" +
        "`{map.tool.select}` cycles through them, " +
        "and `{map.edit.selectLayer}` selects the whole layer.",
      enter: kSelectTool
    },
    {
      id: "clipboard",
      target: ["voxel-edit-toolbar", "jolly-tool-button[data-tool=paste]"],
      side: "above",
      title: "Copy and paste",
      body: "`{map.edit.copy}` copies the selection, `{map.edit.cut}` cuts it, " +
        "and `{map.edit.paste}` or this button pastes it under the cursor.",
      when: (context) => !kPlacing(context),
      enter: kSelectTool
    },
    {
      id: "lift",
      target: ["#game-container"],
      side: "left",
      title: "Select some blocks",
      body: "Drag over blocks in the view to select them.\n\n" +
        "The tour goes on once they are selected.",
      when: TourHooks.when((editing) => {
        const name = editing.state.selection.lastVoxelLayer;
        const layer = name === null ? undefined : editing.editorMap.world.getLayer(name);

        return editing.placement.current === null &&
          editing.access.current.has("voxels") &&
          (layer?.voxelCount ?? 0) > 0;
      }),
      enter: kSelectTool,
      until: TourHooks.until((editing, done) => editing.placement.subscribe(
        "change",
        (current) => {
          if (current !== null) {
            done();
          }
        }
      ))
    },
    {
      id: "placement",
      target: ["voxel-edit-toolbar", "[data-segment=placement]"],
      side: "above",
      title: "Move it",
      body: "Drag the selection to move it, or `Ctrl` + drag to lift it. " +
        "`{map.orient.rotateCounterClockwise}` and `{map.orient.rotateClockwise}` turn it, " +
        "`{map.orient.mirrorHorizontal}` and `{map.orient.flipVertical}` mirror it.\n\n" +
        "`Enter` puts it down and `Esc` cancels.",
      when: kPlacing
    },
    {
      id: "save-template",
      target: ["layers-panel", "template-manager", "jolly-folder[key=templates]"],
      side: "right",
      title: "Templates",
      body: "Save the selection with its Save as template button, " +
        "drag a voxel layer onto this folder, or right click a layer and pick Save as template.",
      enter: kShowLayers
    },
    {
      id: "place-template",
      target: ["layers-panel", "template-manager", "jolly-tree"],
      side: "right",
      title: "Place a template",
      body: "Drag a template into the view to place it, or select it and press `Enter`. " +
        "Double click a template to rename it.",
      when: kHasTemplates,
      enter: kShowLayers
    },
    {
      id: "edit-template",
      target: ["layers-panel", "template-manager", "jolly-button[label=\"Edit template\"]"],
      side: "right",
      title: "Edit a template",
      body: "Edit opens the selected template on its own, with everyone in the room. " +
        "Apply saves the changes, Done goes back to the map and keeps them as a draft, " +
        "and Discard drops them.",
      when: kHasTemplates,
      enter: kShowLayers
    },
    REPLAY_TOUR_STEP
  ]
});
