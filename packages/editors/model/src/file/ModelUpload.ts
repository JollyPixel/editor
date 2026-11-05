// Import Internal Dependencies
import { ModelFileError } from "./errors/ModelFileError.ts";
import { fileExtension } from "./fileExtension.ts";

export class ModelUpload {
  #file: File;

  constructor(
    file: File,
    extension: string
  ) {
    if (fileExtension(file.name) !== extension) {
      throw new ModelFileError(
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
