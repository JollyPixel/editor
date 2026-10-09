// Import Internal Dependencies
import type {
  AnimationInterpolation,
  AnimationKeyJSON,
  Vector3JSON
} from "../../network/types.ts";

// CONSTANTS
const kEasings: Record<AnimationInterpolation, (progress: number) => number> = {
  step: () => 0,
  linear: (progress) => progress,
  smooth: (progress) => progress * progress * (3 - (2 * progress))
};

export class KeyCurve {
  static isOrdered(
    keys: readonly AnimationKeyJSON[]
  ): boolean {
    return keys.every((key, index) => index === 0 || key.tick > keys[index - 1].tick);
  }

  readonly #keys: readonly AnimationKeyJSON[];

  constructor(
    keys: readonly AnimationKeyJSON[]
  ) {
    if (!KeyCurve.isOrdered(keys)) {
      throw new RangeError("Key ticks must strictly rise");
    }

    this.#keys = structuredClone(keys);
  }

  sample(
    tick: number
  ): Vector3JSON | undefined {
    const keys = this.#keys;
    if (keys.length === 0) {
      return undefined;
    }

    const next = this.#firstAfter(tick);
    if (next === 0) {
      return { ...keys[0].value };
    }
    if (next === keys.length) {
      return { ...keys[next - 1].value };
    }

    const from = keys[next - 1];
    const to = keys[next];
    const progress = kEasings[from.interpolation]((tick - from.tick) / (to.tick - from.tick));

    return {
      x: from.value.x + ((to.value.x - from.value.x) * progress),
      y: from.value.y + ((to.value.y - from.value.y) * progress),
      z: from.value.z + ((to.value.z - from.value.z) * progress)
    };
  }

  #firstAfter(
    tick: number
  ): number {
    let low = 0;
    let high = this.#keys.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (this.#keys[middle].tick > tick) {
        high = middle;
      }
      else {
        low = middle + 1;
      }
    }

    return low;
  }
}
