// Import Third-party Dependencies
import type { VoxelCoord } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { MapPlacement } from "../placement/MapPlacement.ts";

export type TemplateDropResult = "commit" | "cancel";

export interface TemplateDropOptions {
  templateId: string;
  placement: Pick<MapPlacement, "placeTemplate" | "cancel" | "store">;
  pointAt(
    clientX: number,
    clientY: number
  ): VoxelCoord | null;
}

export class TemplateDrop {
  readonly #templateId: string;
  readonly #placement: TemplateDropOptions["placement"];
  readonly #pointAt: TemplateDropOptions["pointAt"];
  #placing = false;

  constructor(
    options: TemplateDropOptions
  ) {
    this.#templateId = options.templateId;
    this.#placement = options.placement;
    this.#pointAt = options.pointAt;
  }

  get placing(): boolean {
    return this.#placing;
  }

  hover(
    clientX: number,
    clientY: number
  ): void {
    const position = this.#pointAt(clientX, clientY);
    if (position === null) {
      this.#release();
    }
    else if (this.#placing) {
      this.#placement.store.move(position);
    }
    else {
      this.#placing = this.#placement.placeTemplate(
        this.#templateId,
        position
      );
    }
  }

  finish(
    result: TemplateDropResult
  ): void {
    if (result === "cancel") {
      this.#release();
    }
    this.#placing = false;
  }

  #release(): void {
    if (this.#placing) {
      this.#placing = false;
      this.#placement.cancel();
    }
  }
}
