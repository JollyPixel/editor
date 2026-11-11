// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { TextEdit } from "./TextEdit.ts";
import { ScriptHistory } from "./ScriptHistory.ts";

export type ScriptChangeOrigin = "input" | "history" | "remote" | "load";

export interface ScriptChange {
  readonly edit: TextEdit;
  readonly origin: ScriptChangeOrigin;
  readonly author: string | null;
}

export type ScriptDocumentEvents = {
  change: (change: ScriptChange) => void;
};

export class ScriptDocument extends Emitter<ScriptDocumentEvents> {
  readonly history = new ScriptHistory();

  #text = "";

  get text(): string {
    return this.#text;
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
    text: string
  ): void {
    this.history.clear();
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
