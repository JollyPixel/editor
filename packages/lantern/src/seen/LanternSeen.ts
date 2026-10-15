// Import Third-party Dependencies
import type { StorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { Tour } from "../tour/Tour.ts";

// CONSTANTS
const kKeyPrefix = "jolly-pixel:lantern:";

export class LanternSeen {
  #storage: StorageAdapter;

  constructor(
    storage: StorageAdapter
  ) {
    this.#storage = storage;
  }

  has(
    tour: Tour
  ): boolean {
    const stored = Number(
      this.#storage.get(kKeyPrefix + tour.id)
    );

    return Number.isInteger(stored) && stored >= tour.version;
  }

  record(
    tour: Tour
  ): void {
    this.#storage.set(
      kKeyPrefix + tour.id,
      String(tour.version)
    );
  }

  forget(
    ...tours: Tour[]
  ): void {
    for (const tour of tours) {
      this.#storage.set(
        kKeyPrefix + tour.id,
        "0"
      );
    }
  }
}
