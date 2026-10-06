// Import Third-party Dependencies
import type {
  UVMap,
  UVMapListener
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { BlockSelection } from "../../../state/index.ts";
import type { SlotRegionIds } from "./SlotRegionIds.ts";

/**
 * Keeps block-library and UV-map selection aligned.
 */
export class BlockUvSelectionSync {
  #uv: UVMap;
  #block: BlockSelection;
  #regions: () => SlotRegionIds | null;
  #unsubscribe: () => void;

  constructor(
    uv: UVMap,
    block: BlockSelection,
    regions: () => SlotRegionIds | null
  ) {
    this.#uv = uv;
    this.#block = block;
    this.#regions = regions;
    this.#uv.on("selection-changed", this.#onSelectionChanged);
    this.#unsubscribe = this.#block.subscribe(
      "change",
      this.#onSelectedBlockChange
    );
  }

  refresh(): void {
    this.#onSelectedBlockChange(this.#block.id);
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
      this.#block.id = blockId;
    }
  };

  readonly #onSelectedBlockChange = (id: number): void => {
    const uvId = this.#regions()?.regionIdOf(id) ?? null;

    this.#uv.select(uvId !== null && this.#uv.get(uvId) ? uvId : null);
  };
}
