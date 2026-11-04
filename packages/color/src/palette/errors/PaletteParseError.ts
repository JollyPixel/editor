export class PaletteParseError extends Error {
  readonly line: number | null;

  constructor(
    message: string,
    line: number | null = null
  ) {
    super(line === null ? message : `${message} (line ${line})`);
    this.name = "PaletteParseError";
    this.line = line;
  }
}
