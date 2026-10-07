// Import Internal Dependencies
import { TextureImportError } from "./errors/TextureImportError.ts";

// CONSTANTS
const kSupportedTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif"
]);
const kSupportedExtensions = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif"
]);

interface DraggedFileItem {
  readonly type: string;
  readonly directory: boolean;
}

export class ImageDrop {
  static #accepts(
    file: File
  ): boolean {
    if (kSupportedTypes.has(file.type.toLowerCase())) {
      return true;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();

    return file.type === "" &&
      extension !== undefined &&
      kSupportedExtensions.has(extension);
  }

  readonly #types: readonly string[];
  readonly #items: readonly DraggedFileItem[];
  readonly #files: readonly File[];

  constructor(
    dataTransfer: DataTransfer | null
  ) {
    this.#types = dataTransfer === null ? [] : [...dataTransfer.types];
    this.#files = dataTransfer === null ? [] : [...dataTransfer.files];
    this.#items = dataTransfer === null ?
      [] :
      [...dataTransfer.items]
        .filter((item) => item.kind === "file")
        .map((item) => {
          return {
            type: item.type.toLowerCase(),
            directory: item.webkitGetAsEntry?.()?.isDirectory === true
          };
        });
  }

  get carriesFiles(): boolean {
    return this.#files.length > 0 || this.#types.includes("Files");
  }

  get supported(): boolean {
    if (this.#types.includes("text/uri-list")) {
      return false;
    }
    if (this.#items.length > 0) {
      const [item] = this.#items;

      return this.#items.length === 1 &&
        !item.directory &&
        kSupportedTypes.has(item.type);
    }

    return this.#files.length === 1 && ImageDrop.#accepts(this.#files[0]);
  }

  file(): File {
    if (this.#files.length !== 1) {
      throw new TextureImportError("Drop one image file");
    }

    const [file] = this.#files;
    if (
      this.#items.some((item) => item.directory) ||
      !ImageDrop.#accepts(file)
    ) {
      throw new TextureImportError("Unsupported image format");
    }

    return file;
  }
}
