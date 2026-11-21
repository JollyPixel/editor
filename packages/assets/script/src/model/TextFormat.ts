export type IndentStyle = "tab" | "space";

export interface TextFormatJSON {
  indentStyle: IndentStyle;
  indentSize: number;
  tabWidth: number;
}

// CONSTANTS
export const MAX_INDENT_WIDTH = 16;
const kDefaultWidth = 2;

export class TextFormat {
  static readonly DEFAULT = new TextFormat();

  readonly indentStyle: IndentStyle;
  readonly indentSize: number;
  readonly tabWidth: number;

  constructor(
    options: Partial<TextFormatJSON> = {}
  ) {
    const {
      indentStyle = "space",
      indentSize = kDefaultWidth,
      tabWidth = indentSize
    } = options;

    this.indentStyle = indentStyle;
    this.indentSize = indentWidth(indentSize);
    this.tabWidth = indentWidth(tabWidth);
  }

  get indent(): string {
    return this.indentStyle === "tab" ? "\t" : " ".repeat(this.indentSize);
  }

  equals(
    other: TextFormat
  ): boolean {
    return this.indentStyle === other.indentStyle &&
      this.indentSize === other.indentSize &&
      this.tabWidth === other.tabWidth;
  }

  toJSON(): TextFormatJSON {
    return {
      indentStyle: this.indentStyle,
      indentSize: this.indentSize,
      tabWidth: this.tabWidth
    };
  }
}

function indentWidth(
  width: number
): number {
  if (!Number.isInteger(width) || width < 1 || width > MAX_INDENT_WIDTH) {
    throw new RangeError(
      `An indent width is a whole number from 1 to ${MAX_INDENT_WIDTH}, got ${width}.`
    );
  }

  return width;
}
