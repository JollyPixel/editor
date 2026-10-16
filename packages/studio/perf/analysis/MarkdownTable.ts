export type MarkdownCell = string | number;

export interface MarkdownTableOptions {
  fractionDigits: number;
}

export class MarkdownTable {
  readonly #header: readonly string[];
  readonly #scale: number;
  readonly #rows: string[][] = [];

  constructor(
    header: readonly string[],
    options: MarkdownTableOptions
  ) {
    this.#header = header;
    this.#scale = 10 ** options.fractionDigits;
  }

  add(
    cells: readonly MarkdownCell[]
  ): void {
    this.#rows.push(cells.map((cell) => this.#format(cell)));
  }

  toString(): string {
    return [this.#header, this.#header.map(() => "---"), ...this.#rows]
      .map((cells) => `| ${cells.join(" | ")} |`)
      .join("\n");
  }

  #format(
    cell: MarkdownCell
  ): string {
    return typeof cell === "number" ?
      String(Math.round(cell * this.#scale) / this.#scale) :
      cell;
  }
}
