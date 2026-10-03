// Import Third-party Dependencies
import type {
  UVMap,
  UVMapListener
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { BrushStore } from "../../../state/index.ts";
import type { SlotRegionIds } from "./SlotRegionIds.ts";

/**
 * Keeps block-library and UV-map selection aligned.
 */
export class BlockUvSelectionSync {
  #uv: UVMap;
  #brush: BrushStore;
  #regions: () => SlotRegionIds | null;
  #unsubscribe: () => void;

  constructor(
    uv: UVMap,
    brush: BrushStore,
    regions: () => SlotRegionIds | null
  ) {
    this.#uv = uv;
    this.#brush = brush;
    this.#regions = regions;
    this.#uv.on("selection-changed", this.#onSelectionChanged);
    this.#unsubscribe = this.#brush.subscribe(
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

    const blockId = this.#regions()?.blockIdOf(event.selectedRegionId) ?? null;
    if (blockId !== null) {
      this.#brush.blockId = blockId;
    }
  };

  readonly #onSelectedBlockChange = (id: number): void => {
    const uvId = this.#regions()?.regionIdOf(id) ?? null;

    this.#uv.select(uvId !== null && this.#uv.get(uvId) ? uvId : null);
  };
}
