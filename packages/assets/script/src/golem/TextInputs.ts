// Import Third-party Dependencies
import * as z from "zod/mini";

export const linesInputSchema = z.object({
  from: z.optional(z.int().check(
    z.gte(1),
    z.describe("The first line, from 1. Default 1.")
  )),
  to: z.optional(z.int().check(
    z.gte(1),
    z.describe("The last line, included. Default: the last line.")
  ))
});

export const replaceInputSchema = z.object({
  search: z.string().check(
    z.minLength(1),
    z.describe("The exact text to replace, whitespace included.")
  ),
  replace: z.string().check(z.describe("The new text; empty to delete.")),
  all: z.optional(z.boolean().check(
    z.describe("Replace every occurrence. Default false.")
  ))
});

export const writeInputSchema = z.object({
  text: z.string()
});

export type LinesInput = z.output<typeof linesInputSchema>;

export type ReplaceInput = z.output<typeof replaceInputSchema>;

export type WriteInput = z.output<typeof writeInputSchema>;
