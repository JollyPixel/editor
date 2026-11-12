// Import Third-party Dependencies
import {
  SCRIPT_CARET_PRESENCE_KEY,
  TextEdit,
  type SCRIPT_KIND,
  type SHADER_KIND,
  type ScriptCaretJSON,
  type ScriptCommand,
  type SyncedScript,
  type TEXT_KIND
} from "@jolly-pixel/asset.script/client";
import type { PeerMetadata } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { GolemAsset } from "../GolemAsset.ts";
import { TextMatchError } from "./errors/TextMatchError.ts";

export type TextKind =
  | typeof SCRIPT_KIND
  | typeof SHADER_KIND
  | typeof TEXT_KIND;

export interface LineRange {
  /**
   * The first line, from 1.
   */
  from: number;
  /**
   * The last line, included.
   * @default the last line of the text
   */
  to?: number;
}

export interface TextLines {
  from: number;
  /**
   * The last line read, at most `lineCount`.
   */
  to: number;
  lineCount: number;
  text: string;
}

export interface ReplaceOptions {
  /**
   * Replace every occurrence instead of failing when there are several.
   * @default false
   */
  all?: boolean;
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
    range: LineRange
  ): TextLines {
    const { from, to = Infinity } = range;
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
    search: string,
    replacement: string,
    options: ReplaceOptions = {}
  ): Promise<number> {
    if (search === "") {
      throw new TypeError("The search text is empty.");
    }

    const offsets = occurrences(this.text, search);
    if (offsets.length === 0 || (offsets.length > 1 && !options.all)) {
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
    text: string
  ): Promise<void> {
    const edit = TextEdit.between(this.text, text);
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
