// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

export type LayerVisibilityStoreEvents = {
  change: (key: string) => void;
};

export class LayerVisibilityStore extends Emitter<LayerVisibilityStoreEvents> {
  #overrides = new Map<string, boolean>();

  get keys(): IterableIterator<string> {
    return this.#overrides.keys();
  }

  resolve(
    key: string,
    authored: boolean
  ): boolean {
    return this.#overrides.get(key) ?? authored;
  }

  override(
    key: string,
    visible: boolean
  ): void {
    if (this.#overrides.get(key) === visible) {
      return;
    }

    this.#overrides.set(key, visible);
    this.emit("change", key);
  }

  forget(
    key: string
  ): void {
    if (this.#overrides.delete(key)) {
      this.emit("change", key);
    }
  }

  copy(
    from: string,
    to: string
  ): void {
    const visible = this.#overrides.get(from);
    if (visible !== undefined) {
      this.override(to, visible);
    }
  }

  transfer(
    from: string,
    to: string
  ): void {
    this.copy(from, to);
    this.forget(from);
  }

  retain(
    keep: (key: string) => boolean
  ): void {
    for (const key of [...this.#overrides.keys()]) {
      if (!keep(key)) {
        this.forget(key);
      }
    }
  }
}
