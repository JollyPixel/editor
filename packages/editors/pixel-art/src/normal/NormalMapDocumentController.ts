// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";
import type { PixelDocument } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { NormalMapOverview } from "./NormalMapOverview.ts";

// CONSTANTS
const kUvRefreshEvents = [
  "selection-changed",
  "changed"
] as const;

export class NormalMapDocumentController implements ReactiveController {
  readonly #host: ReactiveControllerHost;
  readonly #document: () => PixelDocument | null;
  #subscribed: PixelDocument | null = null;
  #unsubscribers: (() => void)[] = [];
  #overview: NormalMapOverview | null = null;

  constructor(
    host: ReactiveControllerHost,
    document: () => PixelDocument | null
  ) {
    this.#host = host;
    this.#document = document;
    host.addController(this);
  }

  get overview(): NormalMapOverview | null {
    const doc = this.#document();
    const config = doc?.normalMap ?? null;
    if (doc === null || config === null) {
      return null;
    }

    this.#overview ??= new NormalMapOverview(
      config,
      doc.uv.regions,
      doc.islands
    );

    return this.#overview;
  }

  hostConnected(): void {
    this.#subscribe(this.#document());
  }

  hostUpdate(): void {
    const doc = this.#document();
    if (doc !== this.#subscribed) {
      this.#subscribe(doc);
    }
  }

  hostDisconnected(): void {
    this.#subscribe(null);
  }

  #subscribe(
    doc: PixelDocument | null
  ): void {
    for (const unsubscribe of this.#unsubscribers) {
      unsubscribe();
    }
    this.#unsubscribers = [];
    this.#subscribed = doc;
    this.#overview = null;
    if (doc === null) {
      return;
    }

    this.#unsubscribers = [
      doc.subscribe("normal-map-changed", this.#invalidate),
      doc.subscribe("islands-changed", this.#invalidate),
      ...kUvRefreshEvents.map(
        (event) => doc.uv.subscribe(event, this.#invalidate)
      )
    ];
  }

  readonly #invalidate = (): void => {
    this.#overview = null;
    this.#host.requestUpdate();
  };
}
