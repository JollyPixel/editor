// Import Third-party Dependencies
import type { Preferences } from "@jolly-pixel/editor.host/preferences";
import type { Mode } from "@jolly-pixel/pixel-draw.renderer";
import type { StorageAdapter } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  PIXEL_ART_PREFERENCES,
  type PixelArtPreferences
} from "#src/preferences.ts";
import {
  ViewSettings,
  type ViewCanvas
} from "#src/panel/ViewSettings.ts";

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
const kVisibilityEvents = [
  "visibility-changed",
  "label-visibility-changed",
  "size-label-visibility-changed"
] as const;

export class EditorPreferences {
  readonly #storage: StorageAdapter;
  readonly #preferences: Preferences;
  #mode: Mode;
  #canvas: ViewCanvas | null = null;
  #unwatch: (() => void) | null = null;
  #applying = false;

  constructor(
    storage: StorageAdapter,
    preferences: Preferences
  ) {
    this.#storage = storage;
    this.#preferences = preferences;
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
    this.#apply(this.#preferences.values(PIXEL_ART_PREFERENCES));
    for (const type of kVisibilityEvents) {
      canvas.uv.on(type, this.#saveView);
    }
    canvas.grid.on("changed", this.#saveView);
    this.#unwatch = this.#preferences.watch(
      PIXEL_ART_PREFERENCES,
      this.#apply
    );
  }

  dispose(): void {
    for (const type of kVisibilityEvents) {
      this.#canvas?.uv.off(type, this.#saveView);
    }
    this.#canvas?.grid.off("changed", this.#saveView);
    this.#unwatch?.();
    this.#unwatch = null;
    this.#canvas = null;
  }

  readonly #apply = (
    values: PixelArtPreferences
  ): void => {
    const canvas = this.#canvas;
    if (canvas === null) {
      return;
    }

    this.#applying = true;
    try {
      new ViewSettings(values).applyTo(canvas);
      canvas.grid.size = values.gridSize;
    }
    finally {
      this.#applying = false;
    }
  };

  readonly #saveView = (): void => {
    const canvas = this.#canvas;
    if (canvas === null || this.#applying) {
      return;
    }

    const view = ViewSettings.capture(canvas);
    this.#preferences.update(PIXEL_ART_PREFERENCES, {
      showAll: view.showAll,
      showRegionLabels: view.showRegionLabels,
      showSizeLabels: view.showSizeLabels,
      showGrid: view.showGrid,
      snapToGrid: view.snapToGrid,
      gridSize: canvas.grid.size
    });
  };
}
