// Import Third-party Dependencies
import type { StorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { Tour } from "./tour/Tour.ts";

// CONSTANTS
const kKeyPrefix = "jolly-pixel:lantern:";
const kMutedKey = "jolly-pixel:lantern-muted";
const kMuted = "1";
const kUnmuted = "0";

export class LanternSeen {
  #storage: StorageAdapter;

  constructor(
    storage: StorageAdapter
  ) {
    this.#storage = storage;
  }

  get muted(): boolean {
    return this.#storage.get(kMutedKey) === kMuted;
  }

  mute(): void {
    this.#storage.set(kMutedKey, kMuted);
  }

  unmute(): void {
    this.#storage.set(kMutedKey, kUnmuted);
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
