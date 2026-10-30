// Import Third-party Dependencies
import type {
  PointOfInterestChanges,
  TerrainDocument
} from "@jolly-pixel/asset.terrain/client";

// Import Internal Dependencies
import {
  TERRAIN_HISTORY_SCOPE,
  type TerrainHistory
} from "../../../shared/terrainHistory.ts";
import type { PoiSelection } from "./PoiSelection.ts";

// CONSTANTS
const kBaseName = "Point of interest";

export interface PoiEditorOptions {
  document: Pick<
    TerrainDocument,
    "pointsOfInterest" | "addPointOfInterest" | "updatePointOfInterest" | "removePointOfInterest"
  >;
  history: Pick<TerrainHistory, "record">;
  selection: Pick<PoiSelection, "select">;
}

export class PoiEditor {
  #options: PoiEditorOptions;

  constructor(
    options: PoiEditorOptions
  ) {
    this.#options = options;
  }

  add(): string | null {
    const { document, history, selection } = this.#options;
    const id = history.record(
      TERRAIN_HISTORY_SCOPE,
      null,
      () => document.addPointOfInterest({ name: this.#freeName() })
    );
    if (id !== null) {
      selection.select(id);
    }

    return id;
  }

  update(
    id: string,
    changes: PointOfInterestChanges
  ): boolean {
    const { document, history } = this.#options;

    return history.record(TERRAIN_HISTORY_SCOPE, null, () => document.updatePointOfInterest(id, changes));
  }

  remove(
    id: string
  ): boolean {
    const { document, history } = this.#options;

    return history.record(TERRAIN_HISTORY_SCOPE, null, () => document.removePointOfInterest(id));
  }

  #freeName(): string {
    const taken = new Set(this.#options.document.pointsOfInterest.pointsOfInterest().map(({ name }) => name));
    let index = 1;
    while (taken.has(`${kBaseName} ${index}`)) {
      index++;
    }

    return `${kBaseName} ${index}`;
  }
}
