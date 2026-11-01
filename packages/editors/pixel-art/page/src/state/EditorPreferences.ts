// Import Third-party Dependencies
import type { Mode } from "@jolly-pixel/pixel-draw.renderer";
import type { Preferences } from "@jolly-pixel/preferences";
import type { StorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  PIXEL_ART_PREFERENCES,
  type PixelArtPreferences
} from "#src/preferences.ts";
import type { ViewCanvas } from "#src/panel/ViewSettings.ts";
import { ViewPreferences } from "#src/panel/ViewPreferences.ts";

// CONSTANTS
export const MODE_STORAGE_KEY = "pixel-art:mode";
const kModes = [
  "paint",
  "erase",
  "move",
  "fill",
  "select",
  "uv"
] as const satisfies readonly Mode[];

export class EditorPreferences {
  readonly #storage: StorageAdapter;
  readonly #preferences: Preferences;
  readonly #view: ViewPreferences;
  #mode: Mode;
  #canvas: ViewCanvas | null = null;
  #gridSize = 0;
  #unwatch: (() => void) | null = null;

  constructor(
    storage: StorageAdapter,
    preferences: Preferences
  ) {
    this.#storage = storage;
    this.#preferences = preferences;
    this.#view = new ViewPreferences(preferences);
    const stored = storage.get(MODE_STORAGE_KEY);
    this.#mode = kModes.find((mode) => mode === stored) ?? "paint";
  }

  get mode(): Mode {
    return this.#mode;
  }

  set mode(
    value: Mode
  ) {
    if (value !== this.#mode) {
      this.#mode = value;
      this.#storage.set(MODE_STORAGE_KEY, value);
    }
  }

  activate(
    canvas: ViewCanvas
  ): void {
    if (canvas === this.#canvas) {
      return;
    }

    this.dispose();
    this.#canvas = canvas;
    this.#view.follow(canvas);
    this.#resize(this.#preferences.values(PIXEL_ART_PREFERENCES));
    canvas.grid.on("changed", this.#saveSize);
    this.#unwatch = this.#preferences.watch(
      PIXEL_ART_PREFERENCES,
      this.#resize
    );
  }

  dispose(): void {
    this.#view.dispose();
    this.#canvas?.grid.off("changed", this.#saveSize);
    this.#unwatch?.();
    this.#unwatch = null;
    this.#canvas = null;
  }

  readonly #resize = (
    values: PixelArtPreferences
  ): void => {
    if (this.#canvas !== null) {
      this.#gridSize = values.gridSize;
      this.#canvas.grid.size = values.gridSize;
    }
  };

  readonly #saveSize = (): void => {
    const size = this.#canvas?.grid.size ?? this.#gridSize;
    if (size !== this.#gridSize) {
      this.#gridSize = size;
      this.#preferences.assign(PIXEL_ART_PREFERENCES, "gridSize", size);
    }
  };
}
