// Import Internal Dependencies
import { InvalidAssetNameError } from "./errors/InvalidAssetNameError.ts";

// CONSTANTS
const kSeparator = "/";
const kReservedNames = new Set([".", ".."]);

export class AssetPath {
  static readonly ROOT = new AssetPath([]);

  readonly segments: readonly string[];

  constructor(
    segments: Iterable<string>
  ) {
    this.segments = Object.freeze([
      ...segments
    ]);
  }

  static parse(
    source: string
  ): AssetPath {
    return source === "" ?
      AssetPath.ROOT :
      new AssetPath(source.split(kSeparator));
  }

  get isRoot(): boolean {
    return this.segments.length === 0;
  }

  get name(): string {
    return this.segments.at(-1) ?? "";
  }

  get parent(): AssetPath {
    return this.isRoot ?
      this :
      new AssetPath(this.segments.slice(0, -1));
  }

  get extension(): string {
    const dot = this.name.indexOf(".", 1);

    return dot === -1 ? "" : this.name.slice(dot);
  }

  child(
    name: string
  ): AssetPath {
    assertName(name);

    return new AssetPath([
      ...this.segments,
      name
    ]);
  }

  withName(
    name: string
  ): AssetPath {
    return this.parent.child(name);
  }

  withNameKeepingExtension(
    name: string
  ): AssetPath {
    assertName(name);
    const extension = this.extension;
    if (
      extension === "" ||
      !name.endsWith(extension)
    ) {
      return this.withName(`${name}${extension}`);
    }

    if (name === extension) {
      throw new InvalidAssetNameError(
        name,
        "it is only the extension"
      );
    }

    return this.withName(name);
  }

  moveUnder(
    folder: AssetPath
  ): AssetPath {
    return folder.child(this.name);
  }

  isUnder(
    folder: AssetPath
  ): boolean {
    return folder.segments.length < this.segments.length &&
      folder.segments.every((segment, index) => segment === this.segments[index]);
  }

  rebase(
    from: AssetPath,
    to: AssetPath
  ): AssetPath {
    if (!this.equals(from) && !this.isUnder(from)) {
      return this;
    }

    return new AssetPath([
      ...to.segments,
      ...this.segments.slice(from.segments.length)
    ]);
  }

  equals(
    other: AssetPath
  ): boolean {
    return this.toString() === other.toString();
  }

  toString(): string {
    return this.segments.join(kSeparator);
  }
}

function assertName(
  name: string
): void {
  if (name === "") {
    throw new InvalidAssetNameError(
      name,
      "it is empty"
    );
  }

  if (kReservedNames.has(name)) {
    throw new InvalidAssetNameError(
      name,
      "it is reserved"
    );
  }

  if (
    name.includes(kSeparator) ||
    name.includes("\\")
  ) {
    throw new InvalidAssetNameError(
      name,
      "drag the row to move it instead"
    );
  }
}
