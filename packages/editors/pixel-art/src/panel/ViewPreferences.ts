// Import Third-party Dependencies
import type { Preferences } from "@jolly-pixel/preferences";

// Import Internal Dependencies
import {
  PIXEL_ART_PREFERENCES,
  type PixelArtPreferences
} from "../preferences.ts";
import {
  ViewSettings,
  type ViewCanvas
} from "./ViewSettings.ts";

// CONSTANTS
const kVisibilityEvents = [
  "visibility-changed",
  "label-visibility-changed",
  "size-label-visibility-changed"
] as const;

export class ViewPreferences {
  readonly #preferences: Preferences;
  #canvas: ViewCanvas | null = null;
  #unwatch: (() => void) | null = null;
  #applying = false;

  constructor(
    preferences: Preferences
  ) {
    this.#preferences = preferences;
  }

  follow(
    canvas: ViewCanvas
  ): void {
    if (canvas === this.#canvas) {
      return;
    }

    this.dispose();
    this.#canvas = canvas;
    this.#apply(this.#preferences.values(PIXEL_ART_PREFERENCES));
    for (const type of kVisibilityEvents) {
      canvas.uv.on(type, this.#save);
    }
    canvas.grid.on("changed", this.#save);
    this.#unwatch = this.#preferences.watch(
      PIXEL_ART_PREFERENCES,
      this.#apply
    );
  }

  dispose(): void {
    for (const type of kVisibilityEvents) {
      this.#canvas?.uv.off(type, this.#save);
    }
    this.#canvas?.grid.off("changed", this.#save);
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
    }
    finally {
      this.#applying = false;
    }
  };

  readonly #save = (): void => {
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
      snapToGrid: view.snapToGrid
    });
  };
}
