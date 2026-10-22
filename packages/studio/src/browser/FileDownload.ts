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

  save(): void {
    const url = URL.createObjectURL(this.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = this.fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}
