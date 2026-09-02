
// Import Internal Dependencies
import type { Input } from "./Input.class.ts";
import {
  type MouseAction,
  type GamepadIndex,
  type GamepadButton,
  type ExtendedKeyCode,
  type InputKeyboardAction
} from "./devices/index.ts";

import {
  AtomicInput,
  type InputCondition,
  type CombinedInputAction,
  type CombinedKeyboardInputAction,
  type CombinedMouseInputAction,
  type CombinedInputState
} from "./AtomicInput.ts";

/**
 * Composite condition: ALL inputs must be satisfied.
 */
export class AllInputs implements InputCondition {
  #conditions: InputCondition[];

  constructor(
    conditions: InputCondition[]
  ) {
    this.#conditions = conditions;
  }

  evaluate(
    input: Input
  ): boolean {
    for (const condition of this.#conditions) {
      if (!condition.evaluate(input)) {
        return false;
      }
    }

    return true;
  }

  reset(): void {
    for (const condition of this.#conditions) {
      condition.reset();
    }
  }
}

/**
 * Composite condition: AT LEAST ONE input must be satisfied.
 */
export class AtLeastOneInput implements InputCondition {
  #conditions: InputCondition[];

  constructor(
    conditions: InputCondition[]
  ) {
    this.#conditions = conditions;
  }

  evaluate(
    input: Input
  ): boolean {
    for (const condition of this.#conditions) {
      if (condition.evaluate(input)) {
        return true;
      }
    }

    return false;
  }

  reset(): void {
    for (const condition of this.#conditions) {
      condition.reset();
    }
  }
}

/**
 * Composite condition: NONE of the inputs should be satisfied.
 */
export class NoneInputs implements InputCondition {
  #conditions: InputCondition[];

  constructor(
    conditions: InputCondition[]
  ) {
    this.#conditions = conditions;
  }

  evaluate(
    input: Input
  ): boolean {
    for (const condition of this.#conditions) {
      if (condition.evaluate(input)) {
        return false;
      }
    }

    return true;
  }

  reset(): void {
    for (const condition of this.#conditions) {
      condition.reset();
    }
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
  #now: () => number;

  constructor(
    conditions: InputCondition[],
    timeoutMs: number = SequenceInputs.DefaultTimeout,
    now: () => number = Date.now
  ) {
    this.#conditions = conditions;
    this.#timeoutMs = timeoutMs;
    this.#now = now;
  }

  evaluate(
    input: Input
  ): boolean {
    const now = this.#now();

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
    for (const condition of this.#conditions) {
      condition.reset();
    }
  }
}

export class InputCombination {
  static isCombinedAction(
    action: unknown
  ): action is CombinedInputAction {
    return typeof action === "string" && action.includes(".");
  }

  static key(key: CombinedKeyboardInputAction): AtomicInput;
  static key(
    key: InputKeyboardAction,
    state?: CombinedInputState
  ): AtomicInput;
  static key(
    key: InputKeyboardAction | CombinedKeyboardInputAction,
    state: CombinedInputState = "pressed"
  ): AtomicInput {
    if (InputCombination.isCombinedAction(key)) {
      const [keyCode, keyState] = key.split(
        "."
      ) as [ExtendedKeyCode, CombinedInputState];

      return new AtomicInput(
        "key",
        keyCode,
        keyState
      );
    }

    return new AtomicInput(
      "key",
      key as InputKeyboardAction,
      state
    );
  }

  static mouse(button: CombinedMouseInputAction): AtomicInput;
  static mouse(
    button: MouseAction,
    state?: CombinedInputState
  ): AtomicInput;
  static mouse(
    button: MouseAction | CombinedMouseInputAction,
    state: CombinedInputState = "pressed"
  ): AtomicInput {
    if (InputCombination.isCombinedAction(button)) {
      const [mouseAction, mouseState] = button.split(
        "."
      ) as [MouseAction, CombinedInputState];

      return new AtomicInput(
        "mouse",
        mouseAction,
        mouseState
      );
    }

    return new AtomicInput(
      "mouse",
      button as MouseAction,
      state
    );
  }

  static gamepad(
    gamepad: GamepadIndex,
    button: number | keyof typeof GamepadButton,
    state: CombinedInputState = "pressed"
  ): AtomicInput {
    return new AtomicInput(
      "gamepad",
      [gamepad, button],
      state
    );
  }

  static all(
    ...conditions: (InputCondition | CombinedKeyboardInputAction)[]
  ): AllInputs {
    return new AllInputs(
      conditions.map(
        (condition) => (typeof condition === "string" ?
          InputCombination.key(condition) :
          condition
        )
      )
    );
  }

  static atLeastOne(
    ...conditions: (InputCondition | CombinedKeyboardInputAction)[]
  ): AtLeastOneInput {
    return new AtLeastOneInput(
      conditions.map(
        (condition) => (typeof condition === "string" ?
          InputCombination.key(condition) :
          condition
        )
      )
    );
  }

  static none(
    ...conditions: (InputCondition | CombinedKeyboardInputAction)[]
  ): NoneInputs {
    return new NoneInputs(
      conditions.map(
        (condition) => (typeof condition === "string" ?
          InputCombination.key(condition) :
          condition
        )
      )
    );
  }

  static sequence(
    ...conditions: (InputCondition | CombinedKeyboardInputAction)[]
  ): SequenceInputs {
    return new SequenceInputs(
      conditions.map(
        (condition) => (typeof condition === "string" ?
          InputCombination.key(condition) :
          condition
        )
      )
    );
  }

  static sequenceWithTimeout(
    timeoutMs: number,
    ...conditions: (InputCondition | CombinedKeyboardInputAction)[]
  ): SequenceInputs {
    return new SequenceInputs(
      conditions.map(
        (condition) => (typeof condition === "string" ?
          InputCombination.key(condition) :
          condition
        )
      ),
      timeoutMs
    );
  }
}
