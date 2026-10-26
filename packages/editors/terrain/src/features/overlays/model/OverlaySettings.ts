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

export interface OverlayOptions {
  overlay: TerrainOverlay;
  walkableSlope: number;
}

export type OverlaySettingsEvents = {
  change: (options: Readonly<OverlayOptions>) => void;
};

const kDefaultOptions: Readonly<OverlayOptions> = Object.freeze({
  overlay: "none",
  walkableSlope: DEFAULT_WALKABLE_SLOPE
});

export class OverlaySettings extends Emitter<OverlaySettingsEvents> {
  static parse(
    raw: string | null
  ): Readonly<OverlayOptions> {
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
  #options: Readonly<OverlayOptions>;

  constructor(
    storage: StorageAdapter = new MemoryStorageAdapter()
  ) {
    super();

    this.#storage = storage;
    this.#options = OverlaySettings.parse(storage.get(kStorageKey));
  }

  get options(): Readonly<OverlayOptions> {
    return this.#options;
  }

  update(
    changes: Partial<OverlayOptions>
  ): void {
    const next = OverlaySettings.parse(JSON.stringify({ ...this.#options, ...changes }));
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
): Partial<Record<keyof OverlayOptions, unknown>> {
  try {
    const value: unknown = raw === null ? null : JSON.parse(raw);

    return typeof value === "object" && value !== null ? value : {};
  }
  catch {
    return {};
  }
}
