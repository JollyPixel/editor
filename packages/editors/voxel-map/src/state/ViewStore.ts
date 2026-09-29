// Import Third-party Dependencies
import {
  MemoryStorageAdapter,
  type StorageAdapter
} from "@jolly-pixel/ui";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  ViewSettings,
  type ViewSettingsJSON
} from "./ViewSettings.ts";

// CONSTANTS
const kStorageKey = "voxel-map:view";

export type ViewStoreEvents = {
  change: (settings: ViewSettings) => void;
};

export class ViewStore extends Emitter<ViewStoreEvents> {
  #storage: StorageAdapter;
  #settings: ViewSettings;

  constructor(
    storage: StorageAdapter = new MemoryStorageAdapter()
  ) {
    super();
    this.#storage = storage;
    this.#settings = ViewSettings.parse(storage.get(kStorageKey));
  }

  get settings(): ViewSettings {
    return this.#settings;
  }

  update(
    patch: Partial<ViewSettingsJSON>
  ): void {
    const next = this.#settings.with(patch);
    if (next.equals(this.#settings)) {
      return;
    }

    this.#settings = next;
    this.#storage.set(kStorageKey, JSON.stringify(next));
    this.emit("change", next);
  }
}
