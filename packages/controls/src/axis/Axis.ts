// Import Internal Dependencies
import type { InputDevices } from "../types.ts";
import type {
  GamepadAxis,
  GamepadIndex
} from "../devices/index.ts";
import {
  ButtonAxisSource,
  GamepadAxisSource,
  type AxisHalf,
  type AxisSource
} from "./sources/index.ts";

export interface AxisOptions {
  invert?: boolean;
  scale?: number;
}

export class Axis {
  static buttons(
    positive: AxisHalf,
    negative: AxisHalf = null,
    options: AxisOptions = {}
  ): Axis {
    return new Axis(
      [
        new ButtonAxisSource(positive, negative)
      ],
      options
    );
  }

  static gamepadStick(
    gamepad: GamepadIndex,
    axis: number | keyof typeof GamepadAxis,
    options: AxisOptions = {}
  ): Axis {
    return new Axis(
      [
        new GamepadAxisSource(
          gamepad,
          axis
        )
      ],
      options
    );
  }

  #sources: AxisSource[];
  #sign: number;
  #scale: number;
  #factor: number;

  constructor(
    sources: Iterable<AxisSource>,
    options: AxisOptions = {}
  ) {
    const {
      invert = false,
      scale = 1
    } = options;

    this.#sources = [
      ...sources
    ];
    this.#sign = invert ? -1 : 1;
    this.#scale = scale;
    this.#factor = this.#sign * this.#scale;
  }

  or(
    source: AxisSource
  ): Axis {
    return new Axis(
      [...this.#sources, source],
      {
        invert: this.#sign < 0,
        scale: this.#scale
      }
    );
  }

  sample(
    input: InputDevices
  ): number {
    const sources = this.#sources;
    if (sources.length === 1) {
      return clamp(
        sources[0].sample(input)
      ) * this.#factor;
    }

    let tiedValue = 0;
    let magnitude = 0;

    for (const source of sources) {
      const sampled = clamp(
        source.sample(input)
      );
      const sampledMagnitude = Math.abs(sampled);

      if (sampledMagnitude > magnitude) {
        magnitude = sampledMagnitude;
        tiedValue = sampled;
      }
      else if (sampledMagnitude === magnitude) {
        tiedValue += sampled;
      }
    }

    return Math.sign(tiedValue) * magnitude * this.#factor;
  }

  resetSources(): void {
    for (const source of this.#sources) {
      source.reset();
    }
  }
}

function clamp(
  value: number
): number {
  if (value > 1) {
    return 1;
  }
  if (value < -1) {
    return -1;
  }

  return value;
}
