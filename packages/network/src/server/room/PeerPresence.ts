// Import Internal Dependencies
import type { PeerMetadata } from "../../protocol/types.ts";

// CONSTANTS
const kBracesLength = 2;

export class PeerPresence {
  static readonly EMPTY = new PeerPresence();

  #values: PeerMetadata = {};
  #entryLengths = new Map<string, number>();
  #entriesLength = 0;

  get values(): PeerMetadata {
    return this.#values;
  }

  get length(): number {
    const separators = Math.max(this.#entryLengths.size - 1, 0);

    return kBracesLength + this.#entriesLength + separators;
  }

  patched(
    patch: PeerMetadata
  ): PeerPresence {
    const next = new PeerPresence();
    next.#values = {
      ...this.#values,
      ...patch
    };
    next.#entryLengths = new Map(this.#entryLengths);
    next.#entriesLength = this.#entriesLength;

    for (const [key, value] of Object.entries(patch)) {
      next.#entriesLength -= next.#entryLengths.get(key) ?? 0;
      next.#entryLengths.delete(key);
      if (value === undefined) {
        continue;
      }

      const entryLength = JSON.stringify(key).length + 1 +
        JSON.stringify(value).length;
      next.#entriesLength += entryLength;
      next.#entryLengths.set(key, entryLength);
    }

    return next;
  }
}
