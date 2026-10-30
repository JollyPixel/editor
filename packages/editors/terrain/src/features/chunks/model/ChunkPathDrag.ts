// Import Third-party Dependencies
import type { OpenStep } from "@jolly-pixel/history";
import type { ChunkCoord } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import type { GroundPoint } from "../../brush/model/StampSpacer.ts";
import { chunksAlong } from "./chunksAlong.ts";

export abstract class ChunkPathDrag {
  #step: OpenStep;
  #last: GroundPoint;
  #ended = false;

  constructor(
    step: OpenStep,
    point: GroundPoint
  ) {
    this.#step = step;
    this.#last = point;
  }

  moveTo(
    point: GroundPoint
  ): void {
    if (this.#ended) {
      return;
    }

    this.visit([...chunksAlong(this.#last, point)]);
    this.#last = point;
  }

  end(): void {
    if (this.#ended) {
      return;
    }

    this.#ended = true;
    this.#step.commit();
  }

  protected abstract visit(
    coords: readonly ChunkCoord[]
  ): void;
}
