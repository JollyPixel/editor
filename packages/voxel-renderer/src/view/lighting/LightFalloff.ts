// Import Internal Dependencies
import { MAX_LIGHT_LEVEL } from "../../document/materials/MaterialGroup.ts";
import {
  LIGHT_OPAQUE,
  lightChannel
} from "./packedLight.ts";

// CONSTANTS
const kFocusedSpread = 0.35;
const kFocusedPeak = 2;
const kTexelBytes = 4;
const kOpen = 255;

export type BlockLightFalloff = "wide" | "focused";

export class LightFalloff {
  static readonly WIDE = new LightFalloff("wide", 1, (level) => {
    const fraction = level / MAX_LIGHT_LEVEL;

    return fraction / (3 - (2 * fraction));
  });

  static readonly FOCUSED = new LightFalloff("focused", kFocusedPeak, (level) => {
    if (level === 0) {
      return 0;
    }
    const distance = MAX_LIGHT_LEVEL - level;

    return (1 - (distance / MAX_LIGHT_LEVEL)) /
      (1 + (kFocusedSpread * distance * distance));
  });

  static of(
    name: BlockLightFalloff
  ): LightFalloff {
    return name === "focused" ? LightFalloff.FOCUSED : LightFalloff.WIDE;
  }

  readonly name: BlockLightFalloff;
  readonly peak: number;
  readonly #brightness: readonly number[];
  readonly #bytes: Uint8Array;
  readonly #texels: Uint32Array;

  constructor(
    name: BlockLightFalloff,
    peak: number,
    curve: (level: number) => number
  ) {
    this.name = name;
    this.peak = peak;
    this.#brightness = Array.from(
      { length: MAX_LIGHT_LEVEL + 1 },
      (_, level) => curve(level)
    );
    this.#bytes = Uint8Array.from(
      this.#brightness,
      (brightness) => Math.round(255 * brightness)
    );
    this.#texels = texelTable(this.#bytes);
  }

  brightness(
    level: number
  ): number {
    return this.#brightness[level];
  }

  byteOf(
    level: number
  ): number {
    return this.#bytes[level];
  }

  texelOf(
    cell: number
  ): number {
    return this.#texels[cell];
  }

  tintedLevel(
    level: number,
    share: number
  ): number {
    const target = this.#brightness[level] * share;
    let closest = 0;
    for (let candidate = 1; candidate <= level; candidate++) {
      const distance = Math.abs(this.#brightness[candidate] - target);
      if (distance < Math.abs(this.#brightness[closest] - target)) {
        closest = candidate;
      }
    }

    return closest;
  }
}

function texelTable(
  bytes: Uint8Array
): Uint32Array {
  const texels = new Uint32Array(LIGHT_OPAQUE * 2);
  const view = new Uint8Array(texels.buffer);
  for (let cell = 0; cell < LIGHT_OPAQUE; cell++) {
    const offset = cell * kTexelBytes;
    view[offset] = bytes[lightChannel(cell, 0)];
    view[offset + 1] = bytes[lightChannel(cell, 1)];
    view[offset + 2] = bytes[lightChannel(cell, 2)];
    view[offset + 3] = kOpen;
  }

  return texels;
}
