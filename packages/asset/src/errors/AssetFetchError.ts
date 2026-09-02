// Import Internal Dependencies
import type { AssetRecord } from "../AssetRecord.ts";

/**
 * Reports an asset HTTP request answered with a non-2xx status.
 */
export class AssetFetchError extends Error {
  readonly url: string;
  readonly status: number;
  readonly record: AssetRecord | null;

  constructor(
    url: string,
    status: number,
    record: AssetRecord | null = null
  ) {
    super(`Request to "${url}" responded with ${status}.`);
    this.name = "AssetFetchError";
    this.url = url;
    this.status = status;
    this.record = record;
  }
}
