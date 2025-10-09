/* eslint-disable max-classes-per-file */
// Import Internal Dependencies
import type { Input } from "./Input.class.js";
import {
  type MouseAction,
  type GamepadIndex,
  type GamepadButton,
  type ExtendedKeyCode
} from "./devices/index.js";

import {
  AtomicInput,
  type InputCondition,
  type CombinedInputAction,
  type CombinedInputState
} from "./AtomicInput.js";

/**
 * Composite condition: ALL inputs must be satisfied.
 */
export class AllInputs implements InputCondition {
  #conditions: InputCondition[];

  constructor(conditions: InputCondition[]) {
    this.#conditions = conditions;
  }

  evaluate(input: Input): boolean {
    return this.#conditions.every(
      (condition) => condition.evaluate(input)
    );
  }

  reset(): void {
    this.#conditions.forEach(
      (condition) => condition.reset()
    );
  }
}

/**
 * Composite condition: AT LEAST ONE input must be satisfied.
 */
export class AtLeastOneInput implements InputCondition {
  #conditions: InputCondition[];

  constructor(conditions: InputCondition[]) {
    this.#conditions = conditions;
  }

  evaluate(input: Input): boolean {
    return this.#conditions.some(
      (condition) => condition.evaluate(input)
    );
  }

  reset(): void {
    this.#conditions.forEach(
      (condition) => condition.reset()
    );
  }
}

/**
 * Composite condition: NONE of the inputs should be satisfied.
 */
export class NoneInputs implements InputCondition {
  #conditions: InputCondition[];

  constructor(conditions: InputCondition[]) {
    this.#conditions = conditions;
  }

  evaluate(input: Input): boolean {
    return this.#conditions.every(
      (condition) => !condition.evaluate(input)
    );
  }

  reset(): void {
    this.#conditions.forEach(
      (condition) => condition.reset()
    );
  }
}

/**
 * Sequence condition: inputs must be pressed in specific order within timeout.
 */
export class SequenceInputs implements InputCondition {
  static DefaultTimeout = 100;

  #conditions: InputCondition[];
  #currentIndex = 0;
  #lastActivationTime = 0;
  #timeoutMs: number;

  constructor(
    conditions: InputCondition[],
    timeoutMs: number = SequenceInputs.DefaultTimeout
  ) {
    this.#conditions = conditions;
    this.#timeoutMs = timeoutMs;
  }

  evaluate(
    input: Input
  ): boolean {
    const now = Date.now();

    if (now - this.#lastActivationTime > this.#timeoutMs) {
      this.#currentIndex = 0;
    }

    if (this.#conditions[this.#currentIndex]?.evaluate(input)) {
      this.#currentIndex++;
      this.#lastActivationTime = now;

      if (this.#currentIndex >= this.#conditions.length) {
        this.#currentIndex = 0;

        return true;
      }
    }

    return false;
  }

  reset(): void {
    this.#currentIndex = 0;
    this.#lastActivationTime = 0;
    this.#conditions.forEach((condition) => condition.reset());
  }
}

export class InputCombination {
  static isCombinedAction(
    action: any
  ): action is CombinedInputAction {
    return typeof action === "string" && action.includes(".");
  }

  static key(key: CombinedInputAction): AtomicInput;
  static key(
    key: ExtendedKeyCode,
    state?: CombinedInputState
  ): AtomicInput;
  static key(
    key: ExtendedKeyCode | CombinedInputAction,
    state: CombinedInputState = "pressed"
  ): AtomicInput {
    if (InputCombination.isCombinedAction(key)) {
      const [keyCode, keyState] = key.split(".") as [ExtendedKeyCode, CombinedInputState];

      return new AtomicInput("key", keyCode, keyState);
    }

    return new AtomicInput("key", key as ExtendedKeyCode, state);
  }

  static mouse(button: MouseAction): AtomicInput;
  static mouse(
    button: MouseAction,
    state?: CombinedInputState
  ): AtomicInput;
  static mouse(
    button: MouseAction | CombinedInputAction,
    state: CombinedInputState = "pressed"
  ): AtomicInput {
    if (InputCombination.isCombinedAction(button)) {
      const [mouseAction, mouseState] = button.split(".") as [MouseAction, CombinedInputState];

      return new AtomicInput("mouse", mouseAction, mouseState);
    }

    return new AtomicInput("mouse", button as MouseAction, state);
  }

  static gamepad(
    gamepad: GamepadIndex,
    button: number | keyof typeof GamepadButton,
    state: CombinedInputState = "pressed"
  ): AtomicInput {
    return new AtomicInput("gamepad", [gamepad, button], state);
  }

  static all(
    ...conditions: (InputCondition | CombinedInputAction)[]
  ): AllInputs {
    return new AllInputs(
      conditions.map((condition) => (typeof condition === "string" ? InputCombination.key(condition) : condition))
    );
  }

  static atLeastOne(
    ...conditions: (InputCondition | CombinedInputAction)[]
  ): AtLeastOneInput {
    return new AtLeastOneInput(
      conditions.map((condition) => (typeof condition === "string" ? InputCombination.key(condition) : condition))
    );
  }

  static none(
    ...conditions: (InputCondition | CombinedInputAction)[]
  ): NoneInputs {
    return new NoneInputs(
      conditions.map((condition) => (typeof condition === "string" ? InputCombination.key(condition) : condition))
    );
  }

  static sequence(
    ...conditions: (InputCondition | CombinedInputAction)[]
  ): SequenceInputs {
    return new SequenceInputs(
      conditions.map((condition) => (typeof condition === "string" ? InputCombination.key(condition) : condition))
    );
  }

  static sequenceWithTimeout(
    timeoutMs: number,
    ...conditions: (InputCondition | CombinedInputAction)[]
  ): SequenceInputs {
    return new SequenceInputs(
      conditions.map((condition) => (typeof condition === "string" ? InputCombination.key(condition) : condition)),
      timeoutMs
    );
  }
}
