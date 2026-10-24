// Import Third-party Dependencies
import { REPLAY_TOUR_STEP } from "@jolly-pixel/editor.host";
import { Tour } from "@jolly-pixel/lantern";

// Import Internal Dependencies
import { TourHooks } from "./support/TourHooks.ts";

// CONSTANTS
const kTree = ["layers-panel", "layer-manager", "jolly-tree"];
const kShowLayers = TourHooks.showPane("layers");
const kOnMap = TourHooks.when((editing) => editing.state.editContext.draft === null);

export const layers = new Tour({
  id: "voxel-map.layers",
  version: 1,
  title: "Layers and objects",
  steps: [
    {
      id: "welcome",
      title: "Layers and objects",
      body: "Voxel layers hold blocks. Object layers hold boxes with properties, " +
        "such as spawn points or trigger zones."
    },
    {
      id: "editing-template",
      target: ["voxel-edit-toolbar", "voxel-template-edit-bar"],
      side: "above",
      title: "Back to the map",
      body: "You are editing a template, so the map layers are hidden. " +
        "Press Done to go back to the map, then start this tour again.",
      when: (context) => !kOnMap(context)
    },
    {
      id: "tree",
      target: kTree,
      side: "right",
      title: "Layers",
      body: "The brush builds on the selected voxel layer. " +
        "Drag a voxel layer to change its order.",
      when: kOnMap,
      enter: kShowLayers
    },
    {
      id: "add",
      target: ["layers-panel", "layer-manager", "jolly-button[label=\"Add layer\"]"],
      side: "right",
      title: "Add and remove",
      body: "Add a voxel layer, an object layer, or an object to the selected object layer. " +
        "The next buttons clone and remove the selection.",
      when: kOnMap,
      enter: kShowLayers
    },
    {
      id: "visibility",
      target: kTree,
      side: "right",
      title: "Hide a layer",
      body: "The eye hides a layer on your screen only. " +
        "It is not saved, and the others in the room still see it.",
      when: kOnMap,
      enter: kShowLayers
    },
    {
      id: "menu",
      target: kTree,
      side: "right",
      title: "Layer actions",
      body: "Right click a layer to frame it in the view, duplicate it, merge it into another layer, " +
        "save it as a template or show it alone.",
      when: kOnMap,
      enter: kShowLayers
    },
    {
      id: "inspector",
      target: ["layers-panel", "layer-manager", "layer-panel"],
      side: "right",
      title: "Layer settings",
      body: "Transform moves, turns or mirrors the whole layer. " +
        "Rebase to content origin moves its origin onto its blocks.\n\n" +
        "Custom properties attach your own data to a layer or an object.",
      when: TourHooks.finds(["layers-panel", "layer-manager", "layer-panel"]),
      enter: kShowLayers
    },
    {
      id: "objects",
      target: ["#game-container"],
      side: "left",
      title: "Objects",
      body: "With an object layer selected, click a box in the view to select its object, " +
        "then drag its handles to move or resize it. " +
        "Lock an object in the list to keep it in place.",
      when: kOnMap
    },
    REPLAY_TOUR_STEP
  ]
});
