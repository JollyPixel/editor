// Import Internal Dependencies
import type { Input } from "./Input.class.ts";
import {
  type MouseAction,
  type GamepadIndex,
  type GamepadButton,
  type ExtendedKeyCode
} from "./devices/index.ts";

export interface InputCondition {
  evaluate(input: Input): boolean;
  reset(): void;
}

export type CombinedInputType = "key" | "mouse" | "gamepad";
export type CombinedInputState = "down" | "pressed" | "released";
export type CombinedInputAction = `${ExtendedKeyCode | MouseAction}.${CombinedInputState}`;

export type AtomicInputAction =
  | ExtendedKeyCode
  | MouseAction
  | [GamepadIndex, number | keyof typeof GamepadButton];

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
    const key = this.#action as ExtendedKeyCode;

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
    const [gamepad, button] = this.#action as [
      GamepadIndex,
      number | keyof typeof GamepadButton
    ];

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
