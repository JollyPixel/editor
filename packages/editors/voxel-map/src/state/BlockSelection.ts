// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

export type BlockSelectionEvents = {
  change: (id: number) => void;
};

export class BlockSelection extends Emitter<BlockSelectionEvents> {
  #id = 1;

  get id(): number {
    return this.#id;
  }

  set id(
    id: number
  ) {
    if (this.#id === id) {
      return;
    }

    this.#id = id;
    this.emit("change", id);
  }
}
