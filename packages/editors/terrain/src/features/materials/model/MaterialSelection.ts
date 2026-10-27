// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type { TerrainDocument } from "@jolly-pixel/asset.terrain/client";

export type MaterialSelectionEvents = {
  change: (materialId: string | null) => void;
};

export class MaterialSelection extends Emitter<MaterialSelectionEvents> {
  #document: Pick<TerrainDocument, "materials" | "subscribe">;
  #selected: string | null = null;
  #unsubscribe: Array<() => void>;

  constructor(
    document: Pick<TerrainDocument, "materials" | "subscribe">
  ) {
    super();
    this.#document = document;
    this.#unsubscribe = [
      document.subscribe("change", () => this.#follow()),
      document.subscribe("reset", () => this.#follow())
    ];
    this.#follow();
  }

  get selected(): string | null {
    return this.#selected;
  }

  select(
    materialId: string
  ): void {
    if (this.#document.materials.material(materialId) !== undefined) {
      this.#set(materialId);
    }
  }

  dispose(): void {
    for (const unsubscribe of this.#unsubscribe.splice(0)) {
      unsubscribe();
    }
  }

  #follow(): void {
    const { materials } = this.#document;
    if (this.#selected !== null && materials.material(this.#selected) !== undefined) {
      return;
    }

    this.#set(materials.materials()[0]?.id ?? null);
  }

  #set(
    materialId: string | null
  ): void {
    if (materialId !== this.#selected) {
      this.#selected = materialId;
      this.emit("change", materialId);
    }
  }
}
