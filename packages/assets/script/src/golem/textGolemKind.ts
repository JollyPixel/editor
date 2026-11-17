// Import Third-party Dependencies
import {
  golemIntent,
  golemKind,
  type GolemIntents,
  type GolemKindContribution
} from "@jolly-pixel/golem.kit";
import * as z from "zod/mini";

// Import Internal Dependencies
import { textEditableKind } from "../network/textEditableKind.ts";
import {
  TextAsset,
  type TextKind
} from "./TextAsset.ts";

// CONSTANTS
const kGuide = new URL("./guide.md", import.meta.url);
const kTextIntents: GolemIntents<TextAsset> = {
  read: golemIntent({
    description: "Read the text, whole or a range of lines. Answers the " +
      "text, the lines it covers and the line count.",
    input: z.object({
      from: z.optional(z.int().check(
        z.gte(1),
        z.describe("The first line, from 1. Default 1.")
      )),
      to: z.optional(z.int().check(
        z.gte(1),
        z.describe("The last line, included. Default: the last line.")
      ))
    }),
    run: async(asset: TextAsset, { from = 1, to }) => asset.lines({ from, to })
  }),
  replace: golemIntent({
    description: "Replace a piece of the text. The search text must " +
      "appear exactly once unless all is true: copy enough surrounding " +
      "lines to make it unique. Fails when it is not found.",
    input: z.object({
      search: z.string().check(
        z.minLength(1),
        z.describe("The exact text to replace, whitespace included.")
      ),
      replace: z.string().check(z.describe("The new text; empty to delete.")),
      all: z.optional(z.boolean().check(
        z.describe("Replace every occurrence. Default false.")
      ))
    }),
    run: async(asset: TextAsset, { search, replace, all }) => {
      return {
        replaced: await asset.replace(search, replace, { all })
      };
    }
  }),
  write: golemIntent({
    description: "Replace the whole text. Only the changed part is sent, " +
      "but prefer replace for small changes.",
    input: z.object({
      text: z.string()
    }),
    run: async(asset: TextAsset, { text }) => {
      await asset.write(text);

      return {
        lineCount: asset.lineCount
      };
    }
  })
};

export function textGolemKind<TKind extends TextKind>(
  kind: TKind
): GolemKindContribution<TextAsset<TKind>> {
  return golemKind(textEditableKind(kind), TextAsset<TKind>, {
    guide: kGuide,
    intents: kTextIntents
  });
}
