// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// CONSTANTS
const kWidthListeners = new WeakMap<Element, (width: number) => void>();
let sharedObserver: ResizeObserver | null = null;

export const DEFAULT_STACK_BELOW = 200;

export type FieldLabelPosition = "inline" | "top" | "auto";

export interface LabelStackHost extends ReactiveControllerHost, HTMLElement {
  labelPosition: FieldLabelPosition;
  stackBelow: number;
}

export function resolveStacked(
  width: number,
  stackBelow: number,
  previous: boolean
): boolean {
  if (width <= 0) {
    return previous;
  }

  return width < stackBelow;
}

function widthObserver(): ResizeObserver {
  sharedObserver ??= new ResizeObserver((entries) => {
    for (const entry of entries) {
      const width = entry.borderBoxSize?.[0]?.inlineSize ??
        entry.contentRect.width;
      kWidthListeners.get(entry.target)?.(width);
    }
  });

  return sharedObserver;
}

export class LabelStackController implements ReactiveController {
  #host: LabelStackHost;
  #width = 0;
  #autoStacked = false;
  #observing = false;

  constructor(
    host: LabelStackHost
  ) {
    this.#host = host;
    host.addController(this);
  }

  get stacked(): boolean {
    switch (this.#host.labelPosition) {
      case "top":
        return true;
      case "auto":
        return this.#autoStacked;
      default:
        return false;
    }
  }

  hostConnected(): void {
    this.#syncObservation();
  }

  hostDisconnected(): void {
    this.#unobserve();
  }

  hostUpdate(): void {
    this.#syncObservation();
    this.#autoStacked = resolveStacked(
      this.#width,
      this.#host.stackBelow,
      this.#autoStacked
    );
    this.#host.toggleAttribute("stacked", this.stacked);
  }

  #syncObservation(): void {
    if (this.#host.labelPosition === "auto" && this.#host.isConnected) {
      this.#observe();
    }
    else {
      this.#unobserve();
    }
  }

  #observe(): void {
    if (this.#observing) {
      return;
    }

    this.#observing = true;
    kWidthListeners.set(this.#host, this.#onWidth);
    widthObserver().observe(this.#host);
  }

  #unobserve(): void {
    if (!this.#observing) {
      return;
    }

    this.#observing = false;
    kWidthListeners.delete(this.#host);
    sharedObserver?.unobserve(this.#host);
  }

  readonly #onWidth = (
    width: number
  ): void => {
    this.#width = width;
    const stacked = resolveStacked(
      width,
      this.#host.stackBelow,
      this.#autoStacked
    );
    if (stacked !== this.#autoStacked) {
      this.#autoStacked = stacked;
      this.#host.requestUpdate();
    }
  };
}
