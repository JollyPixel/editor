// Import Third-party Dependencies
import * as z from "zod/mini";

// Import Internal Dependencies
import { InvalidTypefaceError } from "./errors/InvalidTypefaceError.ts";

// CONSTANTS
const kGlyphSchema = z.looseObject({
  ha: z.number(),
  x_min: z.number(),
  x_max: z.number(),
  o: z.optional(z.string())
});

export const TYPEFACE_SCHEMA = z.looseObject({
  glyphs: z.record(z.string(), kGlyphSchema),
  familyName: z.string(),
  ascender: z.number(),
  descender: z.number(),
  underlinePosition: z.number(),
  underlineThickness: z.number(),
  boundingBox: z.object({
    xMin: z.number(),
    xMax: z.number(),
    yMin: z.number(),
    yMax: z.number()
  }),
  resolution: z.number()
});

export type Typeface = z.infer<typeof TYPEFACE_SCHEMA>;

export function decodeTypeface(
  content: Uint8Array
): Typeface {
  let json: unknown;
  try {
    json = JSON.parse(
      new TextDecoder().decode(content)
    );
  }
  catch (error) {
    throw new InvalidTypefaceError(
      "content is not JSON",
      { cause: error }
    );
  }

  const parsed = TYPEFACE_SCHEMA.safeParse(json);
  if (!parsed.success) {
    throw new InvalidTypefaceError(
      "content is not a typeface JSON font",
      { cause: parsed.error }
    );
  }

  return parsed.data;
}

export function encodeTypeface(
  typeface: Typeface
): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify(typeface)
  );
}
