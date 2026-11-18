// Import Third-party Dependencies
import * as z from "zod/mini";

// CONSTANTS
const kColor = z.string().check(z.describe("\"#rrggbb\" or \"#rrggbbaa\"."));
const kRect = {
  x: z.int().check(z.gte(0), z.describe("The left column, from 0.")),
  y: z.int().check(z.gte(0), z.describe("The top row, from 0.")),
  width: z.int().check(z.gte(1)),
  height: z.int().check(z.gte(1))
};

export const pixelRectSchema = z.object(kRect);

export const paintPixelsInputSchema = z.object({
  pixels: z.array(z.object({
    x: z.int().check(z.gte(0)),
    y: z.int().check(z.gte(0)),
    color: kColor
  }))
});

export const fillRectInputSchema = z.object({
  ...kRect,
  color: kColor
});

export const replacePaletteInputSchema = z.object({
  colors: z.array(kColor).check(z.minLength(1))
});

export type PixelRect = z.output<typeof pixelRectSchema>;

export type PaintPixelsInput = z.output<typeof paintPixelsInputSchema>;

export type FillRectInput = z.output<typeof fillRectInputSchema>;

export type ReplacePaletteInput = z.output<typeof replacePaletteInputSchema>;
