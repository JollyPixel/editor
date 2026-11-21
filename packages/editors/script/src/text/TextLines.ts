// Import Third-party Dependencies
import { TextFormat } from "@jolly-pixel/asset.script/client";

// Import Internal Dependencies
import { LineRange } from "./LineRange.ts";

export interface LinePosition {
  readonly line: number;
  readonly column: number;
}

export class TextLines {
  readonly text: string;
  readonly lines: readonly string[];
  readonly format: TextFormat;

  #starts: number[];
  #widest: number | undefined;

  constructor(
    text: string,
    format = TextFormat.DEFAULT
  ) {
    this.text = text;
    this.format = format;
    this.lines = text.split("\n");
    this.#starts = [];
    let start = 0;
    for (const line of this.lines) {
      this.#starts.push(start);
      start += line.length + 1;
    }
  }

  get count(): number {
    return this.lines.length;
  }

  get range(): LineRange {
    return new LineRange(0, this.lines.length - 1);
  }

  get widest(): number {
    if (this.#widest === undefined) {
      this.#widest = 0;
      for (let line = 0; line < this.lines.length; line++) {
        this.#widest = Math.max(this.#widest, this.visualWidth(line));
      }
    }

    return this.#widest;
  }

  line(
    line: number
  ): string {
    return this.lines[line] ?? "";
  }

  position(
    offset: number
  ): LinePosition {
    let low = 0;
    let high = this.#starts.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (this.#starts[middle] <= offset) {
        low = middle;
      }
      else {
        high = middle - 1;
      }
    }

    return {
      line: low,
      column: Math.min(offset - this.#starts[low], this.lines[low].length)
    };
  }

  lineStart(
    line: number
  ): number {
    return this.#starts[line];
  }

  lineBefore(
    offset: number
  ): string {
    return this.text.slice(this.lineStart(this.position(offset).line), offset);
  }

  visualColumn(
    position: LinePosition
  ): number {
    const text = this.line(position.line);
    let column = 0;
    for (let index = 0; index < position.column; index++) {
      column = this.#advance(column, text[index]);
    }

    return column;
  }

  offsetAt(
    line: number,
    visualColumn: number
  ): number | null {
    const text = this.lines[line];
    if (text === undefined) {
      return null;
    }

    let column = 0;
    for (let index = 0; index < text.length; index++) {
      column = this.#advance(column, text[index]);
      if (column > visualColumn) {
        return this.#starts[line] + index;
      }
    }

    return null;
  }

  visualWidth(
    line: number
  ): number {
    return this.visualColumn({
      line,
      column: this.line(line).length
    });
  }

  #advance(
    column: number,
    character: string
  ): number {
    const { tabWidth } = this.format;

    return character === "\t" ?
      column + tabWidth - (column % tabWidth) :
      column + 1;
  }
}
