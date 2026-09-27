// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

export type MaterialFocusEvents = {
  edit: (materialId: string | null) => void;
};

export class MaterialFocusStore extends Emitter<MaterialFocusEvents> {
  #edited: string | null = null;

  get edited(): string | null {
    return this.#edited;
  }

  edit(
    materialId: string | null
  ): void {
    if (materialId === this.#edited) {
      return;
    }
    this.#edited = materialId;
    this.emit("edit", materialId);
  }
}
