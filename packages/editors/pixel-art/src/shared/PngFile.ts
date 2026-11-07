// Import Third-party Dependencies
import { saveFile } from "@jolly-pixel/ui";

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
    saveFile(
      new Blob([this.bytes], { type: "image/png" }),
      this.name
    );
  }
}
