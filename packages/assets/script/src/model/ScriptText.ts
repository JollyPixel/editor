// Import Internal Dependencies
import type { TextEdit } from "./TextEdit.ts";
import {
  toLf,
  type LineEnding
} from "./LineEnding.ts";

// CONSTANTS
const kLineEnding = /\r?\n/;
const kAnyLineEnding = /\r?\n/g;

export class ScriptText {
  lineEnding: LineEnding | null = null;

  #text: string;
  #fileLineEnding: LineEnding = "\n";

  constructor(
    text = ""
  ) {
    this.#text = text;
  }

  get text(): string {
    return this.#text;
  }

  get file(): string {
    const lineEnding = this.lineEnding ?? this.#fileLineEnding;

    return lineEnding === "\n" ?
      this.#text :
      this.#text.replace(kAnyLineEnding, lineEnding);
  }

  load(
    file: string
  ): void {
    this.#fileLineEnding = kLineEnding.exec(file)?.[0] === "\r\n" ?
      "\r\n" :
      "\n";
    this.#text = toLf(file);
  }

  replace(
    text: string
  ): void {
    this.#text = text;
  }

  edit(
    edit: TextEdit
  ): void {
    this.#text = edit.applyTo(this.#text);
  }
}
