// Import Third-party Dependencies
import type { SceneDocument } from "@jolly-pixel/asset.scene/client";
import { Emitter } from "@openally/emitt";

export type SelectionStoreEvents = {
  change: (ids: readonly string[]) => void;
};

export class SelectionStore extends Emitter<SelectionStoreEvents> {
  #ids: readonly string[] = [];
  #unsubscribe: (() => void)[];

  constructor(
    document: SceneDocument
  ) {
    super();
    const prune = (): void => {
      this.select(this.#ids.filter((id) => document.tree.has(id)));
    };
    this.#unsubscribe = [
      document.subscribe("change", prune),
      document.subscribe("reset", prune)
    ];
  }

  get ids(): readonly string[] {
    return this.#ids;
  }

  get primary(): string | null {
    return this.#ids[0] ?? null;
  }

  has(
    id: string
  ): boolean {
    return this.#ids.includes(id);
  }

  select(
    ids: Iterable<string>
  ): void {
    const next = [...new Set(ids)];
    if (
      next.length === this.#ids.length &&
      next.every((id, index) => id === this.#ids[index])
    ) {
      return;
    }

    this.#ids = next;
    this.emit("change", next);
  }

  toggle(
    id: string
  ): void {
    this.select(this.has(id) ?
      this.#ids.filter((selected) => selected !== id) :
      [id, ...this.#ids]);
  }

  dispose(): void {
    for (const unsubscribe of this.#unsubscribe) {
      unsubscribe();
    }
  }
}
