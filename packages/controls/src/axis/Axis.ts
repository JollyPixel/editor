// Import Internal Dependencies
import type { Input } from "../Input.class.ts";
import { InputCombination } from "../CombinedInput.ts";
import type {
  InputCondition,
  CombinedKeyboardInputAction
} from "../AtomicInput.ts";
import type {
  GamepadAxis,
  GamepadIndex,
  InputKeyboardAction
} from "../devices/index.ts";
import {
  ButtonAxisSource,
  GamepadAxisSource,
  type AxisSource
} from "./sources/index.ts";

export type AxisHalf =
  | InputCondition
  | CombinedKeyboardInputAction
  | InputKeyboardAction
  | null;

export interface AxisOptions {
  invert?: boolean;
  scale?: number;
}

function toCondition(
  half: AxisHalf
): InputCondition | null {
  if (half === null || typeof half !== "string") {
    return half;
  }

  return InputCombination.isCombinedAction(half) ?
    InputCombination.key(half) :
    InputCombination.key(half, "down");
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

export class Axis {
  static buttons(
    positive: AxisHalf,
    negative: AxisHalf = null,
    options: AxisOptions = {}
  ): Axis {
    return new Axis(
      [
        new ButtonAxisSource(
          toCondition(positive),
          toCondition(negative)
        )
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

    this.#sources = [...sources];
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
    input: Input
  ): number {
    const sources = this.#sources;

    /**
     * One source cannot tie with itself, so the resolution loop below would
     * only ever reproduce its clamped value.
     */
    if (sources.length === 1) {
      return clamp(sources[0].sample(input)) * this.#factor;
    }

    let tiedValue = 0;
    let magnitude = 0;

    for (const source of sources) {
      const sampled = clamp(source.sample(input));
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
