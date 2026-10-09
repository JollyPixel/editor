// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

export interface RovingFocusHost extends ReactiveControllerHost {
  readonly renderRoot: HTMLElement | DocumentFragment;
}

export class RovingFocus {
  #host: RovingFocusHost;
  #selector: string;
  #focused = 0;

  get focused(): number {
    return this.#focused;
  }

  constructor(
    host: RovingFocusHost,
    selector: string
  ) {
    this.#host = host;
    this.#selector = selector;
  }

  indexAt(
    target: EventTarget | null
  ): number | null {
    if (!(target instanceof Element)) {
      return null;
    }

    const item = target.closest<HTMLElement>(this.#selector);
    const index = Number(item?.dataset.index);

    return item === null || Number.isNaN(index) ? null : index;
  }

  track(
    event: FocusEvent
  ): void {
    const index = this.indexAt(event.target);
    if (index !== null && index !== this.#focused) {
      this.#focused = index;
      this.#host.requestUpdate();
    }
  }

  focus(
    index: number
  ): void {
    this.#focused = index;
    this.#host.requestUpdate();
    void this.#host.updateComplete.then(() => {
      const item = this.#host.renderRoot.querySelector(
        `${this.#selector}[data-index="${index}"]`
      );
      if (item instanceof HTMLElement) {
        item.focus();
      }
    });
  }
}
