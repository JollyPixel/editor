export class AssetPath {
  static from(
    path: string | AssetPath
  ): AssetPath {
    return typeof path === "string"
      ? new AssetPath(path)
      : path;
  }

  readonly directory: string;
  readonly name: string;
  readonly extension: string;

  constructor(
    path: string
  ) {
    if (path.trim().length === 0) {
      throw new TypeError(
        "Asset path must not be empty."
      );
    }

    const slash = path.lastIndexOf("/") + 1;
    const dot = path.indexOf(".", slash + 1);
    const end = dot === -1 ? path.length : dot;

    this.directory = path.slice(0, slash);
    this.name = path.slice(slash, end);
    this.extension = path.slice(end);
  }

  withName(
    name: string
  ): AssetPath {
    return new AssetPath(`${this.directory}${name}${this.extension}`);
  }

  withExtension(
    extension: string
  ): AssetPath {
    if (extension !== "" && !extension.startsWith(".")) {
      throw new TypeError(
        "Asset path extension must be empty or start with \".\"."
      );
    }

    return new AssetPath(`${this.directory}${this.name}${extension}`);
  }

  withoutExtension(): AssetPath {
    return this.withExtension("");
  }

  matchExtension(
    extensions: Iterable<string>
  ): string | null {
    const path = this.toString();
    let matched: string | null = null;
    for (const extension of extensions) {
      if (
        extension.length > (matched?.length ?? 0) &&
        path.endsWith(extension)
      ) {
        matched = extension;
      }
    }

    return matched;
  }

  equals(
    other: AssetPath
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
