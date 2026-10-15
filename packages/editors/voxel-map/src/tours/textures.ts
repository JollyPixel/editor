// Import Third-party Dependencies
import { REPLAY_TOUR_STEP } from "@jolly-pixel/editor.host";
import {
  Tour,
  type StepContext,
  type StepEnter
} from "@jolly-pixel/lantern";

// Import Internal Dependencies
import { showPane } from "./showPane.ts";

function showTextureEditor(
  context: StepContext
): ReturnType<StepEnter> {
  const pane = context.page.querySelector("texture-editor")?.closest("jolly-pane");

  return pane ? showPane(pane.key)(context) : undefined;
}

export const textures = new Tour({
  id: "voxel-map.textures",
  version: 1,
  title: "Textures and materials",
  steps: [
    {
      id: "welcome",
      title: "Textures and materials",
      body: "Every block takes its faces from a blockset texture.\n\n" +
        "This tour shows where to draw them and how to change their look."
    },
    {
      id: "blocksets",
      target: () => document.querySelector("texture-editor"),
      side: "right",
      title: "Blocksets",
      body: "Each tab is a blockset texture. Draw on it with the pixel tools.\n\n" +
        "The UV tool outlines the faces of each block: " +
        "move or resize one to change what the block shows.",
      enter: showTextureEditor
    },
    {
      id: "edit-block",
      target: ["blocks-panel", "[data-tour=edit-block]"],
      side: "right",
      title: "Edit a block",
      body: "Change the picked block's blockset, shape and transparency here.\n\n" +
        "Duplicate it first to keep the original untouched.",
      enter: showPane("blocks")
    },
    {
      id: "materials",
      target: ["materials-panel", "material-library"],
      side: "right",
      title: "Materials",
      body: "A material changes how a block looks, such as its color, without repainting its texture. " +
        "Apply one to the block picked in the library.",
      enter: showPane("materials")
    },
    {
      id: "view",
      target: ["materials-panel", "jolly-folder[key=map-config]"],
      side: "right",
      title: "Lighting",
      body: "Pick the lighting and turn shadows, occlusion, block light, glow and reflections on or off. " +
        "These settings only change your view of the map.",
      enter: showPane("materials")
    },
    REPLAY_TOUR_STEP
  ]
});
