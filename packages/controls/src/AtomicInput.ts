// Import Internal Dependencies
import type { Input } from "./Input.class.ts";
import {
  type MouseAction,
  type GamepadIndex,
  type GamepadButton,
  type ExtendedKeyCode
} from "./devices/index.ts";

export interface InputCondition {
  evaluate(
    input: Input
  ): boolean;
  reset(): void;
}

export type CombinedInputType =
  | "key"
  | "mouse"
  | "gamepad";
export type CombinedInputState =
  | "down"
  | "pressed"
  | "released";
export type CombinedInputAction = `${ExtendedKeyCode | MouseAction}.${CombinedInputState}`;

export type AtomicInputAction =
  | ExtendedKeyCode
  | MouseAction
  | [GamepadIndex, number | keyof typeof GamepadButton];

type AtomicKeyboardInput = {
  type: "key";
  action: ExtendedKeyCode;
};

type AtomicMouseInput = {
  type: "mouse";
  action: MouseAction;
};

type AtomicGamepadInput = {
  type: "gamepad";
  action: [GamepadIndex, number | keyof typeof GamepadButton];
};

type AtomicInputSpec =
  | AtomicKeyboardInput
  | AtomicMouseInput
  | AtomicGamepadInput;

export class AtomicInput implements InputCondition {
  #spec: AtomicInputSpec;
  #state: CombinedInputState;

  constructor(
    type: "key",
    action: ExtendedKeyCode,
    state?: CombinedInputState
  );
  constructor(
    type: "mouse",
    action: MouseAction,
    state?: CombinedInputState
  );
  constructor(
    type: "gamepad",
    action: [GamepadIndex, number | keyof typeof GamepadButton],
    state?: CombinedInputState
  );
  constructor(
    type: CombinedInputType,
    action: AtomicInputAction,
    state: CombinedInputState = "pressed"
  ) {
    this.#spec = { type, action } as AtomicInputSpec;
    this.#state = state;
  }

  evaluate(
    input: Input
  ): boolean {
    switch (this.#spec.type) {
      case "key":
        return this.#evaluateKey(
          input,
          this.#spec.action
        );
      case "mouse":
        return this.#evaluateMouse(
          input,
          this.#spec.action
        );
      case "gamepad":
        return this.#evaluateGamepad(
          input,
          this.#spec.action
        );
      default:
        return false;
    }
  }

  reset(): void {
    // No state to reset for atomic inputs
  }

  #evaluateKey(
    input: Input,
    key: ExtendedKeyCode
  ): boolean {
    switch (this.#state) {
      case "down":
        return input.keyboard.isDown(key);
      case "pressed":
        return input.keyboard.wasJustPressed(key);
      case "released":
        return input.keyboard.wasJustReleased(key);
      default:
        return false;
    }
  }

  #evaluateMouse(
    input: Input,
    button: MouseAction
  ): boolean {
    switch (this.#state) {
      case "down":
        return input.mouse.isDown(button);
      case "pressed":
        return input.mouse.wasJustPressed(button);
      case "released":
        return input.mouse.wasJustReleased(button);
      default:
        return false;
    }
  }

  #evaluateGamepad(
    input: Input,
    [gamepad, button]: [GamepadIndex, number | keyof typeof GamepadButton]
  ): boolean {
    switch (this.#state) {
      case "down":
        return input.gamepad.isButtonDown(
          gamepad,
          button
        );
      case "pressed":
        return input.gamepad.wasButtonJustPressed(
          gamepad,
          button
        );
      case "released":
        return input.gamepad.wasButtonJustReleased(
          gamepad,
          button
        );
      default:
        return false;
    }
  }
}
