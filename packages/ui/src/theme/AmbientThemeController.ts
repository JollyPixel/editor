// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// Import Internal Dependencies
import {
  adoptAmbientTheme,
  type ResolvedThemeMode
} from "./ambientTheme.ts";

export class AmbientThemeController implements ReactiveController {
  #host: ReactiveControllerHost & HTMLElement;
  #adopted: ResolvedThemeMode | null = null;
  #observer: MutationObserver | null = null;
  #frame: number | null = null;

  constructor(
    host: ReactiveControllerHost & HTMLElement
  ) {
    this.#host = host;
    host.addController(this);
  }

  follow(): void {
    this.#adopt();
    if (this.#observer !== null) {
      return;
    }

    this.#observer = new MutationObserver(this.#onMutations);
    this.#observer.observe(this.#host.ownerDocument, {
      attributes: true,
      attributeFilter: ["theme"],
      subtree: true
    });
  }

  stop(): void {
    this.#observer?.disconnect();
    this.#observer = null;
    if (this.#frame !== null) {
      this.#host.ownerDocument.defaultView?.cancelAnimationFrame(this.#frame);
      this.#frame = null;
    }
  }

  hostDisconnected(): void {
    this.stop();
  }

  #adopt(): void {
    this.#adopted = adoptAmbientTheme(this.#host, this.#adopted);
  }

  readonly #onMutations = (
    records: Array<MutationRecord>
  ): void => {
    const view = this.#host.ownerDocument.defaultView;
    if (
      view === null ||
      this.#frame !== null ||
      records.every((record) => record.target === this.#host)
    ) {
      return;
    }

    this.#frame = view.requestAnimationFrame(() => {
      this.#frame = null;
      this.#adopt();
    });
  };
}
