// Import Third-party Dependencies
import { saveFile } from "@jolly-pixel/utils/dom";

// CONSTANTS
const kUnsafeCharacters = /[\\/:*?"<>|]+/g;

export class FileDownload {
  readonly blob: Blob;
  readonly fileName: string;

  constructor(
    blob: Blob,
    fileName: string
  ) {
    this.blob = blob;
    this.fileName = fileName;
  }

  renamed(
    name: string
  ): FileDownload {
    const extension = this.#extension();
    const base = this.#baseName(
      name.replace(kUnsafeCharacters, "-").trim(),
      extension
    );

    return base === "" ?
      this :
      new FileDownload(this.blob, `${base}${extension}`);
  }

  save(): void {
    saveFile(this.blob, this.fileName);
  }

  #extension(): string {
    const dot = this.fileName.lastIndexOf(".");

    return dot > 0 ? this.fileName.slice(dot) : "";
  }

  #baseName(
    name: string,
    extension: string
  ): string {
    const typed = extension !== "" &&
      name.toLowerCase().endsWith(extension.toLowerCase());

    return typed ? name.slice(0, -extension.length).trim() : name;
  }
}
