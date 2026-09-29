// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

export type PointerCaptureEvents = {
  change: (captured: boolean) => void;
};

export class PointerCapture extends Emitter<PointerCaptureEvents> {
  #owners = new Set<object>();

  get captured(): boolean {
    return this.#owners.size > 0;
  }

  capture(
    owner: object
  ): void {
    this.#update(() => this.#owners.add(owner));
  }

  release(
    owner: object
  ): void {
    this.#update(() => this.#owners.delete(owner));
  }

  #update(
    change: () => void
  ): void {
    const before = this.captured;
    change();
    if (this.captured !== before) {
      this.emit("change", this.captured);
    }
  }
}
