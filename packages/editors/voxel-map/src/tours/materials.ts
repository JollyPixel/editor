// Import Third-party Dependencies
import { REPLAY_TOUR_STEP } from "@jolly-pixel/editor.host";
import { Tour } from "@jolly-pixel/lantern";

// Import Internal Dependencies
import { TourHooks } from "./support/TourHooks.ts";

// CONSTANTS
const kFinish = ["materials-panel", "material-library", "material-finish"];
const kView = ["materials-panel", "jolly-folder[key=map-config]"];
const kHasBlocks = TourHooks.when((editing) => editing.editorMap.blocks.size > 0);
const kShowsMaterial = TourHooks.finds(kFinish);
const kShowMaterials = TourHooks.showPane("materials");
const kShowView = TourHooks.openFolder("materials", kView);

export const materials = new Tour({
  id: "voxel-map.materials",
  version: 1,
  title: "Materials and lighting",
  steps: [
    {
      id: "welcome",
      title: "Materials and lighting",
      body: "A material gives blocks a shared finish, such as shine, metal or glow, " +
        "without repainting their texture."
    },
    {
      id: "no-blocks",
      target: ["blocks-panel", "jolly-folder[key=block-library]"],
      side: "right",
      title: "Add a block first",
      body: "Materials apply to blocks, and this map has none yet. " +
        "The Your first block tour shows how to make one.",
      when: (context) => !kHasBlocks(context),
      enter: TourHooks.showPane("blocks")
    },
    {
      id: "library",
      target: ["materials-panel", "jolly-folder[key=material-block-library]"],
      side: "right",
      title: "Pick a block",
      body: "This library picks the block a material applies to.",
      when: kHasBlocks,
      enter: kShowMaterials
    },
    {
      id: "create",
      target: ["materials-panel", "material-library", "jolly-folder[key=materials]"],
      side: "right",
      title: "Materials",
      body: "The plus button creates a material. Double click a material, or press `F2`, " +
        "to rename it, and right click it to duplicate or reset it.",
      when: kHasBlocks,
      enter: kShowMaterials
    },
    {
      id: "pick",
      target: ["materials-panel", "material-library", "jolly-folder[key=materials]"],
      side: "right",
      title: "Pick a material",
      body: "Create a material, or pick one in the list, to edit it.\n\n" +
        "The tour goes on once a material is open.",
      when: (context) => kHasBlocks(context) && !kShowsMaterial(context),
      enter: kShowMaterials,
      until: TourHooks.untilFinds(kFinish)
    },
    {
      id: "apply",
      target: ["materials-panel", "material-library", ".apply"],
      side: "right",
      title: "Apply it",
      body: "Apply the material to the picked block. " +
        "Right clicking a block offers the same choice, and a dot on its tile shows its material.",
      when: kShowsMaterial,
      enter: kShowMaterials
    },
    {
      id: "surface",
      target: kFinish,
      side: "right",
      title: "Surface",
      body: "Roughness, Metalness and Normal strength set how the blocks catch the light. " +
        "Metal only shows with Reflections on in View.",
      when: kShowsMaterial,
      enter: kShowMaterials
    },
    {
      id: "emission",
      target: [...kFinish, "jolly-separator[label=Emission]"],
      side: "right",
      title: "Emission",
      body: "Color and Intensity make the blocks glow when Glow is on. " +
        "Light level lights the blocks around them when Block light is on.\n\n" +
        "Each section has a button to reset it.",
      when: kShowsMaterial,
      enter: kShowMaterials
    },
    {
      id: "lighting",
      target: ["materials-panel", "map-config-panel", "jolly-button-group"],
      side: "right",
      title: "Lighting",
      body: "Flat, Studio, Day or Night. View settings change how you see the map, " +
        "not the map itself, and nobody else sees them.",
      enter: kShowView
    },
    {
      id: "effects",
      target: ["materials-panel", "map-config-panel"],
      side: "right",
      title: "Effects",
      body: "Shadows, Occlusion, Block light, Glow and Reflections. " +
        "Turn them off on a slow machine.\n\n" +
        "The `view` commands of the console toggle the grid and the voxel inspector.",
      enter: kShowView
    },
    REPLAY_TOUR_STEP
  ]
});
