// Import Third-party Dependencies
import type {
  BlockShapeID,
  ResolvedBlockDefinition
} from "@jolly-pixel/voxel.renderer";

export interface ShapePreviewHost {
  requestUpdate(): void;
}

export class ShapePreview {
  #host: ShapePreviewHost;
  #shapeId: BlockShapeID | null = null;
  #source: ResolvedBlockDefinition | null = null;
  #previewed: ResolvedBlockDefinition | null = null;

  constructor(
    host: ShapePreviewHost
  ) {
    this.#host = host;
  }

  show(
    shapeId: BlockShapeID
  ): void {
    this.#shapeId = shapeId;
    this.#host.requestUpdate();
  }

  clear(): void {
    this.#shapeId = null;
  }

  apply(
    block: ResolvedBlockDefinition | null
  ): ResolvedBlockDefinition | null {
    const shapeId = this.#shapeId;
    if (
      block === null ||
      shapeId === null ||
      block.shapeId === shapeId
    ) {
      return block;
    }

    if (this.#source !== block || this.#previewed?.shapeId !== shapeId) {
      this.#source = block;
      this.#previewed = {
        ...block,
        shapeId
      };
    }

    return this.#previewed;
  }
}
