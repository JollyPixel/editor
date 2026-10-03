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
    const url = URL.createObjectURL(
      new Blob([this.bytes], { type: "image/png" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = this.name;
    anchor.click();

    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
