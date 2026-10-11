export class TurntableAngles {
  readonly #rest: number;
  readonly #step: number;
  #angles = new Map<number, number>();

  constructor(
    rest: number,
    step: number
  ) {
    this.#rest = rest;
    this.#step = step;
  }

  angleForBlock(
    blockId: number
  ): number {
    return this.#angles.get(blockId) ?? this.#rest;
  }

  advance(
    blockId: number
  ): number {
    const angle = this.angleForBlock(blockId) + this.#step;
    this.#angles.set(blockId, angle);

    return angle;
  }

  keep(
    blockIds: Iterable<number>
  ): void {
    const kept = new Set(blockIds);
    for (const blockId of this.#angles.keys()) {
      if (!kept.has(blockId)) {
        this.#angles.delete(blockId);
      }
    }
  }
}
