// Import Internal Dependencies
import { downloadBlob } from "./dom.ts";

export class PngFile {
  readonly name: string;
  readonly bytes: Uint8Array<ArrayBuffer>;

  constructor(
    name: string,
    bytes: Uint8Array<ArrayBuffer>
  ) {
    this.name = name;
    this.bytes = bytes;
  }

  download(): void {
    downloadBlob(
      new Blob([this.bytes], { type: "image/png" }),
      this.name
    );
  }
}
