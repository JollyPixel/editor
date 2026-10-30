// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type { TerrainDocument } from "@jolly-pixel/asset.terrain/client";

export interface PoiSelectionState {
  readonly selected: string | null;
  readonly editing: boolean;
}

export type PoiSelectionEvents = {
  change: (state: PoiSelectionState) => void;
};

export class PoiSelection extends Emitter<PoiSelectionEvents> {
  #document: Pick<TerrainDocument, "pointsOfInterest" | "subscribe">;
  #selected: string | null = null;
  #editing = false;
  #unsubscribe: Array<() => void>;

  constructor(
    document: Pick<TerrainDocument, "pointsOfInterest" | "subscribe">
  ) {
    super();
    this.#document = document;
    this.#unsubscribe = [
      document.subscribe("change", () => this.#follow()),
      document.subscribe("reset", () => this.#follow())
    ];
  }

  get selected(): string | null {
    return this.#selected;
  }

  get editing(): boolean {
    return this.#editing;
  }

  select(
    id: string | null
  ): void {
    const known = id !== null && this.#document.pointsOfInterest.pointOfInterest(id) !== undefined;
    this.#set(known ? id : null, known && this.#editing);
  }

  edit(
    editing: boolean
  ): void {
    this.#set(this.#selected, editing && this.#selected !== null);
  }

  dispose(): void {
    for (const unsubscribe of this.#unsubscribe.splice(0)) {
      unsubscribe();
    }
  }

  #follow(): void {
    const selected = this.#selected;
    if (selected !== null && this.#document.pointsOfInterest.pointOfInterest(selected) === undefined) {
      this.#set(null, false);
    }
  }

  #set(
    selected: string | null,
    editing: boolean
  ): void {
    if (selected !== this.#selected || editing !== this.#editing) {
      this.#selected = selected;
      this.#editing = editing;
      this.emit("change", { selected, editing });
    }
  }
}
