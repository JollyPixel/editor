// Import Third-party Dependencies
import { fileExtension } from "@jolly-pixel/utils";

// Import Internal Dependencies
import { TextureFileError } from "../errors/TextureFileError.ts";

export class TextureUpload {
  #file: File;

  constructor(
    file: File,
    extension: string
  ) {
    if (fileExtension(file.name) !== extension) {
      throw new TextureFileError(
        `"${file.name}" is not a ${extension} file.`
      );
    }

    this.#file = file;
  }

  async bytes(): Promise<Uint8Array> {
    return new Uint8Array(
      await this.#file.arrayBuffer()
    );
  }
}
