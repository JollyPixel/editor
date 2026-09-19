// Import Third-party Dependencies
import { DEFAULT_TILE_SIZE } from "@jolly-pixel/voxel.renderer";
import { EditorStore } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import {
  entriesEqual,
  type TilesetEntry
} from "../../features/tilesets/tilesetEntries.ts";

export type TilesetStoreEvents = {
  change: (entries: readonly TilesetEntry[]) => void;
  activeChange: (tilesetId: string | null) => void;
};

export class TilesetStore extends EditorStore<TilesetStoreEvents> {
  #entries: readonly TilesetEntry[] = [];
  #defaultTileSize = DEFAULT_TILE_SIZE;
  #activeTilesetId: string | null = null;

  get entries(): readonly TilesetEntry[] {
    return this.#entries;
  }

  get defaultTileSize(): number {
    return this.#defaultTileSize;
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
    entries: readonly TilesetEntry[],
    defaultTileSize = DEFAULT_TILE_SIZE
  ): void {
    const changed = !entriesEqual(this.#entries, entries) ||
      defaultTileSize !== this.#defaultTileSize;
    this.#entries = [...entries];
    this.#defaultTileSize = defaultTileSize;

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
