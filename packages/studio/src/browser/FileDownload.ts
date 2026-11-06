// Import Third-party Dependencies
import { saveFile } from "@jolly-pixel/ui";

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
    saveFile(this.blob, this.fileName);
  }
}
