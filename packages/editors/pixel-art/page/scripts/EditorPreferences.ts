// Import Third-party Dependencies
import type { Mode } from "@jolly-pixel/pixel-draw.renderer";
import type { StorageAdapter } from "@jolly-pixel/ui";
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  ViewSettings,
  type ViewCanvas
} from "../../src/panel/ViewSettings.ts";

// CONSTANTS
const kStorageKey = "pixel-art:preferences";
const kPreferences = z.object({
  mode: z.catch(
    z.enum([
      "paint",
      "erase",
      "move",
      "fill",
      "select",
      "uv"
    ]),
    "paint"
  ),
  showAll: z.catch(z.boolean(), false),
  showRegionLabels: z.catch(z.boolean(), false),
  showSizeLabels: z.catch(z.boolean(), false),
  showGrid: z.catch(z.boolean(), false),
  snapToGrid: z.catch(z.boolean(), false),
  gridSize: z.catch(z.int().check(z.minimum(1)), 16)
});
const kVisibilityEvents = [
  "visibility-changed",
  "label-visibility-changed",
  "size-label-visibility-changed"
] as const;

export class EditorPreferences {
  readonly #storage: StorageAdapter;
  readonly #state: z.infer<typeof kPreferences>;
  #canvas: ViewCanvas | null = null;

  constructor(
    storage: StorageAdapter
  ) {
    this.#storage = storage;
    try {
      this.#state = kPreferences.parse(
        JSON.parse(storage.get(kStorageKey) ?? "{}")
      );
    }
    catch {
      this.#state = kPreferences.parse({});
    }
  }

  get mode(): Mode {
    return this.#state.mode;
  }

  set mode(
    value: Mode
  ) {
    if (value !== this.#state.mode) {
      this.#state.mode = value;
      this.#save();
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
    new ViewSettings(this.#state).applyTo(canvas);
    canvas.grid.size = this.#state.gridSize;
    for (const type of kVisibilityEvents) {
      canvas.uv.on(type, this.#saveView);
    }
    canvas.grid.on("changed", this.#saveView);
  }

  dispose(): void {
    for (const type of kVisibilityEvents) {
      this.#canvas?.uv.off(type, this.#saveView);
    }
    this.#canvas?.grid.off("changed", this.#saveView);
    this.#canvas = null;
  }

  readonly #saveView = (): void => {
    const canvas = this.#canvas;
    if (canvas) {
      Object.assign(this.#state, ViewSettings.capture(canvas), {
        gridSize: canvas.grid.size
      });
      this.#save();
    }
  };

  #save(): void {
    this.#storage.set(
      kStorageKey,
      JSON.stringify(this.#state)
    );
  }
}
