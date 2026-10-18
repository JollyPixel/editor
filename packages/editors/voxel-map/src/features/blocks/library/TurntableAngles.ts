// Import Internal Dependencies
import type { PreviewAngle } from "../../preview/PreviewStage.ts";

export class TurntableAngles {
  readonly #rest: PreviewAngle;
  readonly #step: number;
  #yaws = new Map<number, number>();

  constructor(
    rest: PreviewAngle,
    step: number
  ) {
    this.#rest = rest;
    this.#step = step;
  }

  angleForBlock(
    blockId: number
  ): PreviewAngle {
    return this.#angle(this.#yawForBlock(blockId));
  }

  advance(
    blockId: number
  ): PreviewAngle {
    const yaw = this.#yawForBlock(blockId) + this.#step;
    this.#yaws.set(blockId, yaw);

    return this.#angle(yaw);
  }

  keep(
    blockIds: Iterable<number>
  ): void {
    const kept = new Set(blockIds);
    for (const blockId of this.#yaws.keys()) {
      if (!kept.has(blockId)) {
        this.#yaws.delete(blockId);
      }
    }
  }

  #yawForBlock(
    blockId: number
  ): number {
    return this.#yaws.get(blockId) ?? this.#rest.yaw;
  }

  #angle(
    yaw: number
  ): PreviewAngle {
    return {
      yaw,
      pitch: this.#rest.pitch
    };
  }
}
