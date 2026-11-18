// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import { MAX_BOX_CELLS } from "./VoxelBox.ts";

// CONSTANTS
const kCell = z.object({
  x: z.int(),
  y: z.int(),
  z: z.int()
});
const kBox = {
  min: kCell.check(z.describe("The lowest cell of the box, included. y is up.")),
  max: kCell.check(
    z.describe(`The highest cell, included. At most ${MAX_BOX_CELLS} cells.`)
  )
};
const kLayer = z.string().check(z.describe("A layer name or id, from summary."));
const kBlock = z.union([z.string(), z.int()]).check(z.describe(
  "A block name, \"<blockset>/<name>\" when two blocksets share it, or a block id."
));

export const queryInputSchema = z.object({
  ...kBox,
  layer: z.optional(kLayer.check(
    z.describe("Only this layer. Default: the visible result of all layers.")
  ))
});

export const heightmapInputSchema = z.object({
  ...kBox,
  layer: z.optional(kLayer.check(
    z.describe("Only this layer. Default: all layers.")
  ))
});

export const addLayerInputSchema = z.object({
  name: z.string(),
  above: z.optional(kLayer.check(
    z.describe("The layer to put it right above. Default: on top.")
  ))
});

export const fillBoxInputSchema = z.object({
  layer: kLayer,
  ...kBox,
  block: kBlock
});

export const clearBoxInputSchema = z.object({
  layer: kLayer,
  ...kBox
});

export type QueryInput = z.output<typeof queryInputSchema>;

export type HeightmapInput = z.output<typeof heightmapInputSchema>;

export type AddLayerInput = z.output<typeof addLayerInputSchema>;

export type FillBoxInput = z.output<typeof fillBoxInputSchema>;

export type ClearBoxInput = z.output<typeof clearBoxInputSchema>;
