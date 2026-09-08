// Import Internal Dependencies
import type { AssetPathRejection } from "../paths.ts";

export class AssetPathEscapeError extends Error {
  readonly path: string;
  readonly reason: AssetPathRejection;

  constructor(
    path: string,
    reason: AssetPathRejection = "traversal"
  ) {
    super(`Asset path "${path}" rejected (${reason}).`);
    this.name = "AssetPathEscapeError";
    this.path = path;
    this.reason = reason;
  }
}
