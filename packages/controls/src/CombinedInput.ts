
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
  bindInputCondition,
  type InputCondition,
  type BoundInputCondition,
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

  bind(
    input: Input
  ): BoundInputCondition {
    return bindInputCondition(this, input);
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

  bind(
    input: Input
  ): BoundInputCondition {
    return bindInputCondition(this, input);
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

  bind(
    input: Input
  ): BoundInputCondition {
    return bindInputCondition(this, input);
  }
}

export class HoldInput implements InputCondition {
  readonly entry: InputCondition;
  readonly sustain: InputCondition;

  constructor(
    entry: InputCondition,
    sustain: InputCondition
  ) {
    this.entry = entry;
    this.sustain = sustain;
  }

  evaluate(
    input: Input
  ): boolean {
    return this.sustain.evaluate(input);
  }

  reset(): void {
    this.entry.reset();
    this.sustain.reset();
  }

  bind(
    input: Input
  ): BoundInputCondition {
    return bindInputCondition(this, input);
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

    this.#rollbackReleasedStep(input);
    if (
      !(this.#conditions[this.#currentIndex - 1] instanceof HoldInput) &&
      now - this.#lastActivationTime > this.#timeoutMs
    ) {
      this.#currentIndex = this.#resumeIndex(this.#currentIndex);
    }

    while (this.#currentIndex < this.#conditions.length) {
      const condition = this.#conditions[this.#currentIndex];
      const isHeld = condition instanceof HoldInput;
      const matched = isHeld ?
        condition.entry.evaluate(input) :
        condition.evaluate(input);
      if (!matched) {
        return false;
      }

      this.#currentIndex++;
      this.#lastActivationTime = now;

      if (this.#currentIndex >= this.#conditions.length) {
        this.#currentIndex = this.#resumeIndex(
          this.#conditions.length - 1
        );

        return true;
      }
      if (!isHeld) {
        return false;
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

  bind(
    input: Input
  ): BoundInputCondition {
    return bindInputCondition(this, input);
  }

  #rollbackReleasedStep(
    input: Input
  ): void {
    for (let index = 0; index < this.#currentIndex; index++) {
      const condition = this.#conditions[index];
      if (
        condition instanceof HoldInput &&
        !condition.sustain.evaluate(input)
      ) {
        this.#currentIndex = index;

        return;
      }
    }
  }

  #resumeIndex(
    limit: number
  ): number {
    for (let index = limit - 1; index >= 0; index--) {
      if (this.#conditions[index] instanceof HoldInput) {
        return index + 1;
      }
    }

    return 0;
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

  static hold(key: ExtendedKeyCode): HoldInput;
  static hold(
    entry: InputCondition,
    sustain: InputCondition
  ): HoldInput;
  static hold(
    entry: ExtendedKeyCode | InputCondition,
    sustain?: InputCondition
  ): HoldInput {
    if (typeof entry === "string") {
      return new HoldInput(
        new AtomicInput("key", entry, "pressed"),
        new AtomicInput("key", entry, "down")
      );
    }
    if (sustain === undefined) {
      throw new TypeError("hold() requires a sustain condition");
    }

    return new HoldInput(entry, sustain);
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
