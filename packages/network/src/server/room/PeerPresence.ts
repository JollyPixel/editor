// Import Internal Dependencies
import type { PeerMetadata } from "../../protocol/types.ts";

// CONSTANTS
const kBracesLength = 2;

export class PeerPresence {
  static readonly EMPTY = new PeerPresence();

  #values: PeerMetadata = {};
  #entries = 0;
  #entriesLength = 0;

  get values(): PeerMetadata {
    return this.#values;
  }

  get length(): number {
    const separators = Math.max(this.#entries - 1, 0);

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
    next.#entries = this.#entries;
    next.#entriesLength = this.#entriesLength;

    for (const key in patch) {
      if (!Object.hasOwn(patch, key)) {
        continue;
      }

      const previous = Object.hasOwn(this.#values, key) ?
        this.#values[key] :
        undefined;
      if (previous !== undefined) {
        next.#entries--;
        next.#entriesLength -= entryLength(key, previous);
      }

      const value = patch[key];
      if (value !== undefined) {
        next.#entries++;
        next.#entriesLength += entryLength(key, value);
      }
    }

    return next;
  }
}

function entryLength(
  key: string,
  value: unknown
): number {
  return JSON.stringify(key).length + 1 + JSON.stringify(value).length;
}
