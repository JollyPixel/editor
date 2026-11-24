// Import Third-party Dependencies
import {
  Err,
  Ok,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import {
  DEFAULT_ARCHIVE_MAX_BYTES,
  DEFAULT_ARCHIVE_MAX_ENTRY_BYTES,
  type ArchiveLimits
} from "../ArchiveLimits.ts";
import { AssetArchiveError } from "../errors/AssetArchiveError.ts";

export function resolveArchiveLimits(
  limits: ArchiveLimits = {}
): Required<ArchiveLimits> {
  return {
    maxEntryBytes: limits.maxEntryBytes ?? DEFAULT_ARCHIVE_MAX_ENTRY_BYTES,
    maxBytes: limits.maxBytes ?? DEFAULT_ARCHIVE_MAX_BYTES
  };
}

export class ArchiveBudget {
  #maxEntryBytes: number;
  #maxBytes: number;
  #total = 0;

  constructor(
    limits: Required<ArchiveLimits>
  ) {
    this.#maxEntryBytes = limits.maxEntryBytes;
    this.#maxBytes = limits.maxBytes;
  }

  admit(
    name: string,
    size: number
  ): Result<void, AssetArchiveError> {
    this.#total += size;
    if (size > this.#maxEntryBytes) {
      const error = new AssetArchiveError(
        "too-large",
        `Archive entry "${name}" exceeds ${this.#maxEntryBytes} bytes.`
      );

      return Err(error);
    }
    if (this.#total > this.#maxBytes) {
      const error = new AssetArchiveError(
        "too-large",
        `Archive exceeds ${this.#maxBytes} decoded bytes.`
      );

      return Err(error);
    }

    return Ok(undefined);
  }
}
