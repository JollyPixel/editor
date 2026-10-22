export class DroppedFile {
  readonly blob: Blob;
  readonly name: string;
  readonly format: string;

  constructor(
    file: File
  ) {
    const dot = file.name.lastIndexOf(".");

    this.blob = file;
    this.name = file.name;
    this.format = dot > 0 ? file.name.slice(dot).toLowerCase() : "";
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
