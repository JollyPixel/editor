// Import Third-party Dependencies
import * as z from "zod/mini";

// CONSTANTS
export const SCRIPT_CARET_PRESENCE_KEY = "caret";

const kOffset = z.int().check(z.minimum(0));

export const scriptCaretSchema = z.object({
  anchor: kOffset,
  head: kOffset
});

export type ScriptCaretJSON = z.infer<typeof scriptCaretSchema>;
