// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

export type DockName = "color" | "normal-map";

export class DockSlot {
  readonly #host: ReactiveControllerHost;
  readonly #onChange: () => void;
  #open: DockName | null = null;

  constructor(
    host: ReactiveControllerHost,
    onChange: () => void
  ) {
    this.#host = host;
    this.#onChange = onChange;
  }

  isOpen(
    name: DockName
  ): boolean {
    return this.#open === name;
  }

  show(
    name: DockName
  ): void {
    this.#update(name);
  }

  hide(
    name: DockName
  ): void {
    if (this.#open === name) {
      this.#update(null);
    }
  }

  toggle(
    name: DockName,
    force = !this.isOpen(name)
  ): void {
    if (force) {
      this.show(name);
    }
    else {
      this.hide(name);
    }
  }

  #update(
    open: DockName | null
  ): void {
    if (open === this.#open) {
      return;
    }

    this.#open = open;
    this.#onChange();
    this.#host.requestUpdate();
  }
}
