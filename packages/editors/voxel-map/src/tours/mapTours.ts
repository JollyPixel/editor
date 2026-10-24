// Import Third-party Dependencies
import type { Tour } from "@jolly-pixel/lantern";

// Import Internal Dependencies
import { basics } from "./basics.ts";
import { firstBlock } from "./firstBlock.ts";
import { painting } from "./painting.ts";
import { uvBlocksets } from "./uvBlocksets.ts";
import { materials } from "./materials.ts";
import { layers } from "./layers.ts";
import { templates } from "./templates.ts";

// CONSTANTS
export const MAP_TOURS = [
  basics,
  firstBlock,
  painting,
  uvBlocksets,
  materials,
  layers,
  templates
];
export const PANE_TOURS: ReadonlyMap<string, Tour> = new Map([
  ["paint", painting],
  ["materials", materials],
  ["layers", layers]
]);
export const MAP_TOUR_KEYS = "map";
export const PIXEL_ART_TOUR_KEYS = "pixelart";
