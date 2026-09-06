// Import Third-party Dependencies
import type {
  UVMap,
  UVMapListener
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { BrushStore } from "../../../app/state/index.ts";
import {
  blockIdFromUvRegion,
  blockUvRegionId
} from "../uv/blockUvProjection.ts";

/** Keeps block-library and UV-map selection aligned. */
export class BlockUvSelectionSync {
  #uv: UVMap;
  #brush: BrushStore;
  #unsubscribe: () => void;

  constructor(
    uv: UVMap,
    brush: BrushStore
  ) {
    this.#uv = uv;
    this.#brush = brush;
    this.#uv.on("selection-changed", this.#onSelectionChanged);
    this.#unsubscribe = this.#brush.watch(
      "blockChange",
      this.#onSelectedBlockChange
    );
  }

  refresh(): void {
    this.#onSelectedBlockChange(this.#brush.blockId);
  }

  dispose(): void {
    this.#uv.off("selection-changed", this.#onSelectionChanged);
    this.#unsubscribe();
  }

  readonly #onSelectionChanged: UVMapListener<"selection-changed"> = (
    event
  ) => {
    if (event.selectedRegionId === null) {
      return;
    }

    const blockId = blockIdFromUvRegion(event.selectedRegionId);
    if (blockId !== null) {
      this.#brush.blockId = blockId;
    }
  };

  readonly #onSelectedBlockChange = (id: number): void => {
    const uvId = blockUvRegionId(id);

    this.#uv.select(this.#uv.get(uvId) ? uvId : null);
  };
}
