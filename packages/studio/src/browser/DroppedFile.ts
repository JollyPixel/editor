// Import Third-party Dependencies
import { fileExtension } from "@jolly-pixel/utils";

export class DroppedFile {
  readonly blob: Blob;
  readonly name: string;
  readonly format: string;

  constructor(
    file: File
  ) {
    this.blob = file;
    this.name = file.name;
    this.format = fileExtension(file.name);
    Object.freeze(this);
  }

  get size(): number {
    return this.blob.size;
  }

  get stem(): string {
    return this.name.slice(0, this.name.length - this.format.length);
  }

  async bytes(): Promise<Uint8Array> {
    return new Uint8Array(await this.blob.arrayBuffer());
  }
}
