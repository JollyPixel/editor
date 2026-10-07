// CONSTANTS
const kFallbackName = "Texture";

export class TextureName {
  static fromPath(
    path: string
  ): TextureName {
    const baseName = path.split(/[\\/]/).at(-1) ?? "";
    const extensionIndex = baseName.lastIndexOf(".");

    return new TextureName(
      extensionIndex > 0 ? baseName.slice(0, extensionIndex) : baseName
    );
  }

  readonly value: string;

  constructor(
    value: string
  ) {
    this.value = value === "" ? kFallbackName : value;
    Object.freeze(this);
  }

  toString(): string {
    return this.value;
  }
}
