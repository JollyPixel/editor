// Import Internal Dependencies
import type {
  ExportRequest,
  ExportTarget
} from "./ExportTarget.ts";

// CONSTANTS
export const EXPORT_START = "export-start";

export class ExportStartEvent extends Event {
  readonly exportTarget: ExportTarget;
  readonly request: ExportRequest;

  constructor(
    exportTarget: ExportTarget,
    request: ExportRequest
  ) {
    super(EXPORT_START);
    this.exportTarget = exportTarget;
    this.request = request;
  }
}

declare global {
  interface HTMLElementEventMap {
    "export-start": ExportStartEvent;
  }
}
