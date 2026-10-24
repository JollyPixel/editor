// Import Third-party Dependencies
import type { TourRun } from "@jolly-pixel/lantern";

type LanternElement = HTMLElementTagNameMap["jolly-lantern"];

export class LazyLanternElement {
  readonly #parent: HTMLElement;
  readonly #warn: (message: string) => void;
  #run: TourRun | null = null;
  #loading = false;
  #element: LanternElement | null = null;
  #disposed = false;

  constructor(
    parent: HTMLElement,
    warn: (message: string) => void
  ) {
    this.#parent = parent;
    this.#warn = warn;
  }

  present(
    run: TourRun
  ): void {
    this.#run = run;
    if (this.#element !== null) {
      this.#element.run = run;
    }
    else if (!this.#loading) {
      this.#loading = true;
      void this.#mount().catch((error: unknown) => {
        this.#loading = false;
        this.#warn(
          `The tour overlay failed to load: ${error instanceof Error ? error.message : String(error)}`
        );
      });
    }
  }

  dispose(): void {
    this.#disposed = true;
    this.#element?.remove();
    this.#element = null;
  }

  async #mount(): Promise<void> {
    await import("@jolly-pixel/lantern/element");
    if (this.#disposed || this.#run === null) {
      return;
    }

    const element = this.#parent.ownerDocument.createElement("jolly-lantern");
    this.#parent.append(element);
    element.run = this.#run;
    this.#element = element;
  }
}
