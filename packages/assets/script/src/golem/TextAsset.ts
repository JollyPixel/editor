// Import Third-party Dependencies
import { GolemAsset } from "@jolly-pixel/golem.kit";
import type { PeerMetadata } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import {
  SCRIPT_CARET_PRESENCE_KEY,
  TextEdit,
  type SCRIPT_KIND,
  type ScriptCaretJSON,
  type ScriptCommand,
  type SHADER_KIND,
  type SyncedScript,
  type TEXT_KIND
} from "../network/client.ts";
import { TextMatchError } from "./errors/TextMatchError.ts";
import type {
  LinesInput,
  ReplaceInput,
  WriteInput
} from "./TextInputs.ts";

export type TextKind =
  | typeof SCRIPT_KIND
  | typeof SHADER_KIND
  | typeof TEXT_KIND;

export interface TextLines {
  from: number;
  /**
   * The last line read, at most `lineCount`.
   */
  to: number;
  lineCount: number;
  text: string;
}

export class TextAsset<
  TKind extends TextKind = TextKind
> extends GolemAsset<ScriptCommand, SyncedScript> {
  declare readonly kind: TKind;

  get text(): string {
    return this.synced.document.text;
  }

  get lineCount(): number {
    return this.text.split("\n").length;
  }

  read(): string {
    return this.text;
  }

  lines(
    input: LinesInput = {}
  ): TextLines {
    const { from = 1, to = Infinity } = input;
    if (!Number.isInteger(from) || from < 1 || to < from) {
      throw new RangeError(
        `Lines ${from} to ${to} are not a range of lines counted from 1.`
      );
    }

    const lines = this.text.split("\n");

    return {
      from,
      to: Math.min(to, lines.length),
      lineCount: lines.length,
      text: lines.slice(from - 1, to).join("\n")
    };
  }

  async replace(
    input: ReplaceInput
  ): Promise<number> {
    const { search, replace: replacement, all = false } = input;
    if (search === "") {
      throw new TypeError("The search text is empty.");
    }

    const offsets = occurrences(this.text, search);
    if (offsets.length === 0 || (offsets.length > 1 && !all)) {
      throw new TextMatchError(search, offsets.length);
    }

    await this.apply([
      {
        action: "edited",
        changes: offsets.toReversed().flatMap((at) => [
          { at, delete: search },
          ...(replacement === "" ? [] : [{ at, insert: replacement }])
        ])
      }
    ]);

    return offsets.length;
  }

  async write(
    input: WriteInput
  ): Promise<void> {
    const edit = TextEdit.between(this.text, input.text);
    if (!edit.empty) {
      await this.apply([
        {
          action: "edited",
          changes: edit.toJSON()
        }
      ]);
    }
  }

  protected focus(
    commands: readonly ScriptCommand[]
  ): PeerMetadata | null {
    const last = commands.at(-1)?.changes.at(-1);
    if (last === undefined) {
      return null;
    }

    const offset = "insert" in last ? last.at + last.insert.length : last.at;
    const caret: ScriptCaretJSON = {
      anchor: offset,
      head: offset
    };

    return { [SCRIPT_CARET_PRESENCE_KEY]: caret };
  }
}

function occurrences(
  text: string,
  search: string
): number[] {
  const offsets: number[] = [];
  let at = text.indexOf(search);
  while (at !== -1) {
    offsets.push(at);
    at = text.indexOf(search, at + search.length);
  }

  return offsets;
}
