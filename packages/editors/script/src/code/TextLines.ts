export interface LinePosition {
  readonly line: number;
  readonly column: number;
}

// CONSTANTS
const kTabSize = 2;

export class TextLines {
  readonly lines: readonly string[];

  #starts: number[];

  constructor(
    text: string
  ) {
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

  get widest(): number {
    let widest = 0;
    for (let line = 0; line < this.lines.length; line++) {
      widest = Math.max(widest, this.visualColumn({
        line,
        column: this.lines[line].length
      }));
    }

    return widest;
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

  visualColumn(
    position: LinePosition
  ): number {
    const text = this.lines[position.line] ?? "";
    let column = 0;
    for (let index = 0; index < position.column; index++) {
      column = text[index] === "\t" ?
        column + kTabSize - (column % kTabSize) :
        column + 1;
    }

    return column;
  }
}
