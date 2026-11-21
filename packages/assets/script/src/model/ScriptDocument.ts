// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { TextEdit } from "./TextEdit.ts";
import { ScriptHistory } from "./ScriptHistory.ts";
import { TextFormat } from "./TextFormat.ts";

export type ScriptChangeOrigin = "input" | "history" | "remote" | "load";

export interface ScriptChange {
  readonly edit: TextEdit;
  readonly origin: ScriptChangeOrigin;
  readonly author: string | null;
}

export type ScriptDocumentEvents = {
  change: (change: ScriptChange) => void;
  formatChange: (format: TextFormat) => void;
};

export class ScriptDocument extends Emitter<ScriptDocumentEvents> {
  readonly history = new ScriptHistory();

  #text = "";
  #format = TextFormat.DEFAULT;

  get text(): string {
    return this.#text;
  }

  get format(): TextFormat {
    return this.#format;
  }

  edit(
    edit: TextEdit
  ): void {
    if (this.#commit(edit, "input")) {
      this.history.record(edit);
    }
  }

  undo(): boolean {
    return this.#commit(this.history.undo(), "history");
  }

  redo(): boolean {
    return this.#commit(this.history.redo(), "history");
  }

  load(
    text: string,
    format = this.#format
  ): void {
    this.history.clear();
    if (!format.equals(this.#format)) {
      this.#format = format;
      this.emit("formatChange", format);
    }
    this.#commit(TextEdit.between(this.#text, text), "load");
  }

  applyRemote(
    edit: TextEdit,
    author: string | null = null
  ): void {
    if (this.#commit(edit, "remote", author)) {
      this.history.rebase(edit);
    }
  }

  #commit(
    edit: TextEdit | null,
    origin: ScriptChangeOrigin,
    author: string | null = null
  ): boolean {
    if (edit === null || edit.empty) {
      return false;
    }

    this.#text = edit.applyTo(this.#text);
    this.emit("change", {
      edit,
      origin,
      author
    });

    return true;
  }
}
