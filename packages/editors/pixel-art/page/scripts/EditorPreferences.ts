// Import Third-party Dependencies
import type {
  Mode,
  PixelArtCanvas
} from "@jolly-pixel/pixel-draw.renderer";
import type { StorageAdapter } from "@jolly-pixel/ui";
import * as z from "zod";

// CONSTANTS
const kStorageKey = "pixel-art:preferences";
const kPreferences = z.object({
  mode: z
    .enum([
      "paint",
      "erase",
      "move",
      "fill",
      "select",
      "uv"
    ])
    .catch("paint"),
  showAll: z.boolean().catch(false),
  showRegionLabels: z.boolean().catch(false),
  showSizeLabels: z.boolean().catch(false)
});
const kVisibilityEvents = [
  "visibility-changed",
  "label-visibility-changed",
  "size-label-visibility-changed"
] as const;

export class EditorPreferences {
  readonly #storage: StorageAdapter;
  readonly #state: z.infer<typeof kPreferences>;
  #canvas: PixelArtCanvas | null = null;

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
    canvas: PixelArtCanvas
  ): void {
    if (canvas === this.#canvas) {
      return;
    }

    this.dispose();
    this.#canvas = canvas;
    canvas.uv.showAll = this.#state.showAll;
    canvas.uv.showRegionLabels = this.#state.showRegionLabels;
    canvas.uv.showSizeLabels = this.#state.showSizeLabels;
    for (const type of kVisibilityEvents) {
      canvas.uv.on(type, this.#saveVisibility);
    }
  }

  dispose(): void {
    for (const type of kVisibilityEvents) {
      this.#canvas?.uv.off(type, this.#saveVisibility);
    }
    this.#canvas = null;
  }

  readonly #saveVisibility = (): void => {
    const uv = this.#canvas?.uv;
    if (uv) {
      this.#state.showAll = uv.showAll;
      this.#state.showRegionLabels = uv.showRegionLabels;
      this.#state.showSizeLabels = uv.showSizeLabels;
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
