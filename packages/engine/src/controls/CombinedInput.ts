/* eslint-disable max-classes-per-file */
// Import Internal Dependencies
import type { Input } from "./Input.class.js";
import {
  type MouseAction,
  type GamepadIndex
} from "./targets/index.js";
import * as Keyboard from "./keyboard/code.js";

export interface InputCondition {
  evaluate(input: Input): boolean;
  reset(): void;
}

export type CombinedInputType = "key" | "mouse" | "gamepad";
export type CombinedInputState = "down" | "pressed" | "released";
export type CombinedInputAction = `${Keyboard.ExtendedKeyCode | MouseAction}.${CombinedInputState}`;

export type AtomicInputAction =
  | Keyboard.ExtendedKeyCode
  | MouseAction
  | [GamepadIndex, number];

export class AtomicInput implements InputCondition {
  #type: CombinedInputType;
  #action: AtomicInputAction;
  #state: CombinedInputState;

  constructor(
    type: CombinedInputType,
    action: AtomicInputAction,
    state: CombinedInputState = "pressed"
  ) {
    this.#type = type;
    this.#action = action;
    this.#state = state;
  }

  evaluate(
    input: Input
  ): boolean {
    switch (this.#type) {
      case "key":
        return this.#evaluateKey(input);
      case "mouse":
        return this.#evaluateMouse(input);
      case "gamepad":
        return this.#evaluateGamepad(input);
      default:
        return false;
    }
  }

  reset(): void {
    // No state to reset for atomic inputs
  }

  #evaluateKey(
    input: Input
  ): boolean {
    const key = this.#action as Keyboard.ExtendedKeyCode;

    switch (this.#state) {
      case "down":
        return input.isKeyDown(key);
      case "pressed":
        return input.wasKeyJustPressed(key);
      case "released":
        return input.wasKeyJustReleased(key);
      default:
        return false;
    }
  }

  #evaluateMouse(
    input: Input
  ): boolean {
    const button = this.#action as MouseAction;

    switch (this.#state) {
      case "down":
        return input.isMouseButtonDown(button);
      case "pressed":
        return input.wasMouseButtonJustPressed(button);
      case "released":
        return input.wasMouseButtonJustReleased(button);
      default:
        return false;
    }
  }

  #evaluateGamepad(
    input: Input
  ): boolean {
    const [gamepad, button] = this.#action as [GamepadIndex, number];

    if (typeof button === "number") {
      switch (this.#state) {
        case "down":
          return input.isGamepadButtonDown(gamepad, button);
        case "pressed":
          return input.wasGamepadButtonJustPressed(gamepad, button);
        case "released":
          return input.wasGamepadButtonJustReleased(gamepad, button);
        default:
          return false;
      }
    }

    return false;
  }
}

/**
 * Composite condition: ALL inputs must be satisfied.
 */
export class AllInputs implements InputCondition {
  #conditions: InputCondition[];

  constructor(conditions: InputCondition[]) {
    this.#conditions = conditions;
  }

  evaluate(input: Input): boolean {
    return this.#conditions.every((condition) => condition.evaluate(input));
  }

  reset(): void {
    this.#conditions.forEach((condition) => condition.reset());
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
    return this.#conditions.some((condition) => condition.evaluate(input));
  }

  reset(): void {
    this.#conditions.forEach((condition) => condition.reset());
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
    return this.#conditions.every((condition) => !condition.evaluate(input));
  }

  reset(): void {
    this.#conditions.forEach((condition) => condition.reset());
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
    key: Keyboard.ExtendedKeyCode,
    state?: CombinedInputState
  ): AtomicInput;
  static key(
    key: Keyboard.ExtendedKeyCode | CombinedInputAction,
    state: CombinedInputState = "pressed"
  ): AtomicInput {
    if (InputCombination.isCombinedAction(key)) {
      const [keyCode, keyState] = key.split(".") as [Keyboard.ExtendedKeyCode, CombinedInputState];

      return new AtomicInput("key", keyCode, keyState);
    }

    return new AtomicInput("key", key as Keyboard.ExtendedKeyCode, state);
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
    button: number,
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
