// Import Third-party Dependencies
import {
  scriptCaretSchema,
  type ScriptCaretJSON,
  type TextEdit
} from "@jolly-pixel/asset.script/client";
import * as z from "zod/mini";

export type CaretField = Pick<
  HTMLTextAreaElement,
  "selectionStart" | "selectionEnd" | "selectionDirection" | "setSelectionRange"
>;

export class ScriptCaret {
  static collapsed(
    offset: number
  ): ScriptCaret {
    return new ScriptCaret(offset, offset);
  }

  static from(
    field: CaretField
  ): ScriptCaret {
    const { selectionStart, selectionEnd, selectionDirection } = field;

    return selectionDirection === "backward" ?
      new ScriptCaret(selectionEnd, selectionStart) :
      new ScriptCaret(selectionStart, selectionEnd);
  }

  static parse(
    value: unknown
  ): ScriptCaret | null | undefined {
    if (value === null) {
      return null;
    }

    const result = z.safeParse(scriptCaretSchema, value);

    return result.success ?
      new ScriptCaret(result.data.anchor, result.data.head) :
      undefined;
  }

  readonly anchor: number;
  readonly head: number;

  constructor(
    anchor: number,
    head: number
  ) {
    this.anchor = anchor;
    this.head = head;
  }

  get start(): number {
    return Math.min(this.anchor, this.head);
  }

  get end(): number {
    return Math.max(this.anchor, this.head);
  }

  get collapsed(): boolean {
    return this.anchor === this.head;
  }

  get backward(): boolean {
    return this.anchor > this.head;
  }

  resized(
    start: number,
    end: number
  ): ScriptCaret {
    return this.backward ?
      new ScriptCaret(end, start) :
      new ScriptCaret(start, end);
  }

  selectIn(
    field: CaretField
  ): void {
    field.setSelectionRange(
      this.start,
      this.end,
      this.backward ? "backward" : "forward"
    );
  }

  follow(
    edit: TextEdit
  ): ScriptCaret {
    return new ScriptCaret(
      edit.mapPosition(this.anchor, "before"),
      edit.mapPosition(this.head, "before")
    );
  }

  clamp(
    length: number
  ): ScriptCaret {
    return new ScriptCaret(
      Math.min(this.anchor, length),
      Math.min(this.head, length)
    );
  }

  equals(
    other: ScriptCaret
  ): boolean {
    return this.anchor === other.anchor && this.head === other.head;
  }

  toJSON(): ScriptCaretJSON {
    return {
      anchor: this.anchor,
      head: this.head
    };
  }
}
