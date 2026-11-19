// Import Third-party Dependencies
import {
  TextEdit,
  type TextChange
} from "@jolly-pixel/asset.script/client";
import type { ScriptCompletion } from "@jolly-pixel/scripting/language";

export interface AcceptedCompletion {
  readonly edit: TextEdit;
  readonly caret: number;
}

export interface CompletionWindow {
  readonly first: number;
  readonly items: readonly ScriptCompletion[];
}

export class CompletionList {
  readonly text: string;
  readonly items: readonly ScriptCompletion[];
  readonly selected: number;

  static from(
    text: string,
    items: readonly ScriptCompletion[]
  ): CompletionList | null {
    return items.length === 0 ? null : new CompletionList(text, items, 0);
  }

  constructor(
    text: string,
    items: readonly ScriptCompletion[],
    selected: number
  ) {
    this.text = text;
    this.items = items;
    this.selected = selected;
  }

  get chosen(): ScriptCompletion {
    return this.items[this.selected];
  }

  move(
    delta: number
  ): CompletionList {
    const count = this.items.length;

    return new CompletionList(
      this.text,
      this.items,
      (((this.selected + delta) % count) + count) % count
    );
  }

  window(
    size: number
  ): CompletionWindow {
    const first = Math.max(
      Math.min(this.selected - Math.floor(size / 2), this.items.length - size),
      0
    );

    return {
      first,
      items: this.items.slice(first, first + size)
    };
  }

  accept(
    index = this.selected
  ): AcceptedCompletion {
    const { start, length, insertText } = this.items[index];
    const changes: TextChange[] = [
      { at: start, delete: this.text.slice(start, start + length) },
      { at: start, insert: insertText }
    ];

    return {
      edit: new TextEdit(changes),
      caret: start + insertText.length
    };
  }
}
