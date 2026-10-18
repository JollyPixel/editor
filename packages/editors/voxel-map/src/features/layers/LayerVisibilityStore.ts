// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { LayerRef } from "../../state/index.ts";

export type LayerVisibilityStoreEvents = {
  change: (key: string) => void;
};

export class LayerVisibilityStore extends Emitter<LayerVisibilityStoreEvents> {
  #overrides = new Map<string, boolean>();

  get keys(): IterableIterator<string> {
    return this.#overrides.keys();
  }

  visibilityOverride(
    key: string
  ): boolean | undefined {
    return this.#overrides.get(key);
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

  showOnly(
    ref: LayerRef,
    entries: Iterable<LayerRef>
  ): void {
    const path = ref.kind === "object" ? [ref, ref.layer] : [ref];
    for (const entry of entries) {
      const onPath = path.some((step) => step.equals(entry));
      const sibling = path.some(
        (step) => parentName(step) === parentName(entry)
      );
      if (onPath || sibling) {
        this.override(entry.key, onPath);
      }
    }
  }

  showAll(
    entries: Iterable<LayerRef>
  ): void {
    for (const entry of entries) {
      this.override(entry.key, true);
    }
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

function parentName(
  ref: LayerRef
): string | null {
  return ref.kind === "object" ? ref.layerName : null;
}
