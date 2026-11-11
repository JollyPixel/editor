// Import Third-party Dependencies
import type { ParsedLine } from "sugar-high/core";

// Import Internal Dependencies
import {
  highlight,
  type ScriptLanguage
} from "./highlight.ts";
import { changedSpan } from "../text/changedSpan.ts";
import type { TextLines } from "../text/TextLines.ts";

// CONSTANTS
const kDeferAboveLength = 16 * 1024;
const kDeferMs = 250;

export class CodeTokens {
  #refreshed: () => void;
  #language: ScriptLanguage = "plaintext";
  #lines: readonly ParsedLine[] = [];
  #text = "";
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    refreshed: () => void
  ) {
    this.#refreshed = refreshed;
  }

  line(
    index: number
  ): ParsedLine | undefined {
    return this.#lines[index];
  }

  reset(
    lines: TextLines,
    language: ScriptLanguage
  ): void {
    this.#language = language;
    this.#lines = [];
    this.read(lines);
  }

  read(
    lines: TextLines
  ): void {
    this.#text = lines.text;
    if (this.#lines.length === 0 || lines.text.length < kDeferAboveLength) {
      this.#cancel();
      this.#lines = highlight(lines.text, this.#language);

      return;
    }

    this.#lines = this.#patched(lines.lines);
    this.#cancel();
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      this.#lines = highlight(this.#text, this.#language);
      this.#refreshed();
    }, kDeferMs);
  }

  dispose(): void {
    this.#cancel();
  }

  #cancel(): void {
    clearTimeout(this.#timer);
    this.#timer = undefined;
  }

  #patched(
    lines: readonly string[]
  ): ParsedLine[] {
    const previous = this.#lines;
    const { start, beforeEnd, afterEnd } = changedSpan(
      previous,
      lines,
      (parsed, line) => parsed.value === line
    );
    const changed = lines
      .slice(start, afterEnd)
      .map((line) => highlight(line, this.#language)[0]);

    return [...previous.slice(0, start), ...changed, ...previous.slice(beforeEnd)];
  }
}
