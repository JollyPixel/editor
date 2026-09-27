// Import Internal Dependencies
import type { AssetId } from "../AssetId.ts";
import type { AssetStatus } from "../runtime/AssetHandle.ts";

/**
 * Reports synchronous access to an asset that has not finished loading.
 */
export class AssetNotReadyError extends Error {
  readonly id: AssetId;
  readonly status: AssetStatus;

  constructor(
    id: AssetId,
    status: AssetStatus
  ) {
    super(`Asset "${id}" is not ready. Current status: "${status}".`);
    this.name = "AssetNotReadyError";
    this.id = id;
    this.status = status;
  }
}
