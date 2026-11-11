// Import Internal Dependencies
import type { TextEdit } from "./TextEdit.ts";

export class ScriptText {
  #text: string;

  constructor(
    text = ""
  ) {
    this.#text = text;
  }

  get text(): string {
    return this.#text;
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
