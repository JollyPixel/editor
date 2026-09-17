export class AssetSource {
  static from(
    source: string | AssetSource
  ): AssetSource {
    return typeof source === "string" ? new AssetSource(source) : source;
  }

  readonly directory: string;
  readonly name: string;
  readonly extension: string;

  constructor(
    source: string
  ) {
    const slash = source.lastIndexOf("/") + 1;
    const dot = source.indexOf(".", slash + 1);
    const end = dot === -1 ? source.length : dot;

    this.directory = source.slice(0, slash);
    this.name = source.slice(slash, end);
    this.extension = source.slice(end);
  }

  withName(
    name: string
  ): AssetSource {
    return new AssetSource(`${this.directory}${name}${this.extension}`);
  }

  equals(
    other: AssetSource
  ): boolean {
    return this.toString() === other.toString();
  }

  toJSON(): string {
    return this.toString();
  }

  toString(): string {
    return `${this.directory}${this.name}${this.extension}`;
  }
}
