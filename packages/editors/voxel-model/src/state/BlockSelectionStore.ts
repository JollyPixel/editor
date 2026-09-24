// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

export type BlockSelectionEvents = {
  select: (uuid: string | null) => void;
  hover: (uuid: string | null) => void;
};

export type BlockMark = keyof BlockSelectionEvents;

export class BlockSelectionStore extends Emitter<BlockSelectionEvents> {
  #selected: string | null = null;
  #hovered: string | null = null;

  get selected(): string | null {
    return this.#selected;
  }

  get hovered(): string | null {
    return this.#hovered;
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

  forget(
    uuid: string
  ): void {
    if (this.#selected === uuid) {
      this.select(null);
    }
    if (this.#hovered === uuid) {
      this.hover(null);
    }
  }
}
