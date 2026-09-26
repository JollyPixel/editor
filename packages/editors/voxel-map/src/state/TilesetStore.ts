// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  entriesEqual,
  type TilesetEntry
} from "./tilesetEntry.ts";

export type TilesetStoreEvents = {
  change: (entries: readonly TilesetEntry[]) => void;
  activeChange: (tilesetId: string | null) => void;
};

export class TilesetStore extends Emitter<TilesetStoreEvents> {
  #entries: readonly TilesetEntry[] = [];
  #activeTilesetId: string | null = null;

  get entries(): readonly TilesetEntry[] {
    return this.#entries;
  }

  get firstTilesetId(): string | null {
    return this.#entries[0]?.definition.id ?? null;
  }

  get activeTilesetId(): string | null {
    return this.#activeTilesetId;
  }

  set activeTilesetId(
    tilesetId: string | null
  ) {
    const next = tilesetId !== null && this.entry(tilesetId) === undefined ?
      this.#activeTilesetId :
      tilesetId;
    if (next === this.#activeTilesetId) {
      return;
    }

    this.#activeTilesetId = next;
    this.emit("activeChange", next);
  }

  entry(
    tilesetId: string
  ): TilesetEntry | undefined {
    return this.#entries.find(
      (entry) => entry.definition.id === tilesetId
    );
  }

  ids(): Set<string> {
    return new Set(this.#entries.map((entry) => entry.definition.id));
  }

  replace(
    entries: readonly TilesetEntry[]
  ): void {
    const changed = !entriesEqual(this.#entries, entries);
    this.#entries = [...entries];

    const active = this.#activeTilesetId;
    if (active === null || this.entry(active) === undefined) {
      this.#activeTilesetId = this.firstTilesetId;
      if (this.#activeTilesetId !== active) {
        this.emit("activeChange", this.#activeTilesetId);
      }
    }
    if (changed) {
      this.emit("change", this.#entries);
    }
  }
}
