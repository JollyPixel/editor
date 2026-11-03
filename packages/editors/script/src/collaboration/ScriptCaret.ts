// Import Third-party Dependencies
import type { TextEdit } from "@jolly-pixel/asset.script/client";
import * as z from "zod/mini";

// CONSTANTS
const kOffset = z.int().check(z.minimum(0));
const kCaretSchema = z.object({
  anchor: kOffset,
  head: kOffset
});

export class ScriptCaret {
  static parse(
    value: unknown
  ): ScriptCaret | null | undefined {
    if (value === null) {
      return null;
    }

    const result = z.safeParse(kCaretSchema, value);

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

  toJSON(): z.infer<typeof kCaretSchema> {
    return {
      anchor: this.anchor,
      head: this.head
    };
  }
}
