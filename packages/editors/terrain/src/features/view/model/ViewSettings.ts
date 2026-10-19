// Import Third-party Dependencies
import {
  DEFAULT_WALKABLE_SLOPE,
  MAX_WALKABLE_SLOPE,
  TERRAIN_OVERLAYS,
  type TerrainOverlay
} from "@jolly-pixel/terrain.renderer";
import {
  MemoryStorageAdapter,
  type StorageAdapter
} from "@jolly-pixel/ui";
import { Emitter } from "@openally/emitt";

// CONSTANTS
const kStorageKey = "terrain:view";

export interface ViewOptions {
  overlay: TerrainOverlay;
  walkableSlope: number;
}

export type ViewSettingsEvents = {
  change: (options: Readonly<ViewOptions>) => void;
};

const kDefaultOptions: Readonly<ViewOptions> = Object.freeze({
  overlay: "none",
  walkableSlope: DEFAULT_WALKABLE_SLOPE
});

export class ViewSettings extends Emitter<ViewSettingsEvents> {
  static parse(
    raw: string | null
  ): Readonly<ViewOptions> {
    const stored = parseObject(raw);
    const slope = stored.walkableSlope;

    return Object.freeze({
      overlay: TERRAIN_OVERLAYS.find((known) => known === stored.overlay) ?? kDefaultOptions.overlay,
      walkableSlope: typeof slope === "number" && Number.isFinite(slope) ?
        Math.min(Math.max(slope, 0), MAX_WALKABLE_SLOPE) :
        kDefaultOptions.walkableSlope
    });
  }

  #storage: StorageAdapter;
  #options: Readonly<ViewOptions>;

  constructor(
    storage: StorageAdapter = new MemoryStorageAdapter()
  ) {
    super();

    this.#storage = storage;
    this.#options = ViewSettings.parse(storage.get(kStorageKey));
  }

  get options(): Readonly<ViewOptions> {
    return this.#options;
  }

  update(
    changes: Partial<ViewOptions>
  ): void {
    const next = ViewSettings.parse(JSON.stringify({ ...this.#options, ...changes }));
    if (next.overlay === this.#options.overlay && next.walkableSlope === this.#options.walkableSlope) {
      return;
    }

    this.#options = next;
    this.#storage.set(kStorageKey, JSON.stringify(next));
    this.emit("change", next);
  }
}

function parseObject(
  raw: string | null
): Partial<Record<keyof ViewOptions, unknown>> {
  try {
    const value: unknown = raw === null ? null : JSON.parse(raw);

    return typeof value === "object" && value !== null ? value : {};
  }
  catch {
    return {};
  }
}
