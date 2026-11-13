// CONSTANTS
const kRelativeBase = "asset:/";
const kEscapes = /(?:%[\dA-Fa-f]{2})+/g;

export class AssetPath {
  static from(
    path: string | AssetPath
  ): AssetPath {
    return typeof path === "string"
      ? new AssetPath(path)
      : path;
  }

  readonly value: string;
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

    this.value = path;
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
    let matched: string | null = null;
    for (const extension of extensions) {
      if (
        extension.length > (matched?.length ?? 0) &&
        this.value.endsWith(extension)
      ) {
        matched = extension;
      }
    }

    return matched;
  }

  resolve(
    specifier: string
  ): AssetPath {
    const url = new URL(
      specifier.replaceAll("\\", "/"),
      new URL(this.value, kRelativeBase)
    );

    return new AssetPath(
      url.href.startsWith(kRelativeBase) ?
        decodeEscapes(url.pathname.slice(1)) :
        url.href
    );
  }

  equals(
    other: AssetPath
  ): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }

  toString(): string {
    return this.value;
  }
}

function decodeEscapes(
  path: string
): string {
  return path.replaceAll(kEscapes, (escapes) => {
    try {
      return decodeURIComponent(escapes);
    }
    catch {
      return escapes;
    }
  });
}
