// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

export type BlockSelectionEvents = {
  select: (uuid: string | null) => void;
  hover: (uuid: string | null) => void;
  emphasize: (uuids: readonly string[]) => void;
};

/** The marks peers see; an emphasis stays with this person. */
export type BlockMark = "select" | "hover";

export class BlockSelectionStore extends Emitter<BlockSelectionEvents> {
  #selected: string | null = null;
  #hovered: string | null = null;
  #emphasized: readonly string[] = [];

  get selected(): string | null {
    return this.#selected;
  }

  get hovered(): string | null {
    return this.#hovered;
  }

  get emphasized(): readonly string[] {
    return this.#emphasized;
  }

  select(
    uuid: string | null
  ): void {
    this.#selected = uuid;
    this.emit("select", uuid);
  }

  hover(
    uuid: string | null
  ): void {
    if (uuid === this.#hovered) {
      return;
    }
    this.#hovered = uuid;
    this.emit("hover", uuid);
  }

  emphasize(
    uuids: Iterable<string>
  ): void {
    const next = [...new Set(uuids)];
    if (next.length === 0 && this.#emphasized.length === 0) {
      return;
    }
    this.#emphasized = next;
    this.emit("emphasize", next);
  }

  forget(
    uuid: string
  ): void {
    if (this.#selected === uuid) {
      this.select(null);
    }
    if (this.#hovered === uuid) {
      this.hover(null);
    }
    if (this.#emphasized.includes(uuid)) {
      this.emphasize(this.#emphasized.filter((emphasized) => emphasized !== uuid));
    }
  }
}
