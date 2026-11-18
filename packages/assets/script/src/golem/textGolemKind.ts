// Import Third-party Dependencies
import {
  golemIntent,
  golemKind,
  type GolemIntents,
  type GolemKindContribution
} from "@jolly-pixel/golem.kit";

// Import Internal Dependencies
import { textEditableKind } from "../network/textEditableKind.ts";
import {
  TextAsset,
  type TextKind
} from "./TextAsset.ts";
import {
  linesInputSchema,
  replaceInputSchema,
  writeInputSchema
} from "./TextInputs.ts";

// CONSTANTS
const kGuide = new URL("./guide.md", import.meta.url);
const kTextIntents: GolemIntents<TextAsset> = {
  lines: golemIntent({
    description: "Read the text, whole or a range of lines. Answers the " +
      "text, the lines it covers and the line count.",
    input: linesInputSchema,
    run: async(asset: TextAsset, input) => asset.lines(input)
  }),
  replace: golemIntent({
    description: "Replace a piece of the text. The search text must " +
      "appear exactly once unless all is true: copy enough surrounding " +
      "lines to make it unique. Fails when it is not found. Answers the " +
      "number of occurrences replaced.",
    input: replaceInputSchema,
    run: (asset: TextAsset, input) => asset.replace(input)
  }),
  write: golemIntent({
    description: "Replace the whole text. Only the changed part is sent, " +
      "but prefer replace for small changes.",
    input: writeInputSchema,
    run: (asset: TextAsset, input) => asset.write(input)
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
