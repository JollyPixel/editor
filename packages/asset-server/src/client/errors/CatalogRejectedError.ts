// Import Internal Dependencies
import type { CatalogCommandType } from "../../catalog/protocol.ts";

export class CatalogRejectedError extends Error {
  readonly command: CatalogCommandType;

  constructor(
    reason: string,
    command: CatalogCommandType
  ) {
    super(reason);
    this.name = "CatalogRejectedError";
    this.command = command;
  }
}
