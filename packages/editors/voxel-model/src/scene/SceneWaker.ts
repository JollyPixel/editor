// Import Third-party Dependencies
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";
import type { ModelDocument } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import type {
  MaterialPreviews,
  PresenceStore,
  ViewSettingsStore
} from "../state/index.ts";
import type { TransformLock } from "../features/transform/index.ts";

export interface SceneWakerOptions {
  document: ModelDocument;
  previews: MaterialPreviews;
  pixels: PixelDocument;
  presence: PresenceStore;
  lock: TransformLock;
  view: ViewSettingsStore;
  requestFrame: () => void;
}

export class SceneWaker {
  #subscriptions: Array<() => void>;

  constructor(
    options: SceneWakerOptions
  ) {
    const {
      document,
      previews,
      pixels,
      presence,
      lock,
      view,
      requestFrame
    } = options;

    this.#subscriptions = [
      document.subscribe("change", requestFrame),
      document.subscribe("reset", requestFrame),
      previews.subscribe("change", requestFrame),
      pixels.subscribe("changed", requestFrame),
      pixels.subscribe("resized", requestFrame),
      pixels.subscribe("replaced", requestFrame),
      presence.subscribe("peersChange", requestFrame),
      presence.subscribe("blockSelectionsChange", requestFrame),
      presence.subscribe("blockHoversChange", requestFrame),
      lock.subscribe("change", requestFrame),
      view.subscribe("change", requestFrame)
    ];
  }

  dispose(): void {
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
  }
}
