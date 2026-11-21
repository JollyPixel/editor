// Import Internal Dependencies
import type { TextEdit } from "./TextEdit.ts";

export type LineEnding = "\n" | "\r\n";

// CONSTANTS
const kLineEnding = /\r?\n/;
const kAnyLineEnding = /\r?\n/g;

export class ScriptText {
  #text: string;
  #lineEnding: LineEnding = "\n";

  constructor(
    text = ""
  ) {
    this.#text = text;
  }

  get text(): string {
    return this.#text;
  }

  get file(): string {
    return this.#lineEnding === "\n" ?
      this.#text :
      this.#text.replace(kAnyLineEnding, this.#lineEnding);
  }

  load(
    file: string
  ): void {
    this.#lineEnding = kLineEnding.exec(file)?.[0] === "\r\n" ? "\r\n" : "\n";
    this.#text = file.replaceAll("\r\n", "\n");
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
