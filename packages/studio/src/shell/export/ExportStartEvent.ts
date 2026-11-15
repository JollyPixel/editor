// Import Internal Dependencies
import type { ExportTarget } from "./ExportTarget.ts";

// CONSTANTS
export const EXPORT_START = "export-start";

export class ExportStartEvent extends Event {
  readonly exportTarget: ExportTarget;
  readonly fileName: string;

  constructor(
    exportTarget: ExportTarget,
    fileName: string
  ) {
    super(EXPORT_START);
    this.exportTarget = exportTarget;
    this.fileName = fileName;
  }
}

declare global {
  interface HTMLElementEventMap {
    "export-start": ExportStartEvent;
  }
}
