// Import Internal Dependencies
import type { CatalogCommandType } from "../protocol.ts";

export class CatalogRejectedError extends Error {
  readonly command: CatalogCommandType | null;

  constructor(
    reason: string,
    command: CatalogCommandType | null = null
  ) {
    super(reason);
    this.name = "CatalogRejectedError";
    this.command = command;
  }
}
