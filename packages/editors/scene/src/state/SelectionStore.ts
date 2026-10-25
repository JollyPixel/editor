// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

export type SelectionStoreEvents = {
  change: (ids: readonly string[]) => void;
};

export class SelectionStore extends Emitter<SelectionStoreEvents> {
  #ids: readonly string[] = [];

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

  retain(
    exists: (id: string) => boolean
  ): void {
    this.select(this.#ids.filter(exists));
  }
}
