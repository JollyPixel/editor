// Import Internal Dependencies
import type { Input } from "../../Input.class.ts";
import type {
  InputMouseAction,
  GamepadIndex,
  GamepadButton,
  InputKeyboardAction
} from "../../devices/index.ts";
import {
  bindInputCondition,
  type InputCondition,
  type BoundInputCondition
} from "./InputCondition.ts";
import type { CombinedInputState } from "../types.ts";

export type CombinedInputType =
  | "key"
  | "mouse"
  | "gamepad";

export type AtomicInputAction =
  | InputKeyboardAction
  | InputMouseAction
  | AtomicGamepadAction;

type AtomicGamepadAction = [GamepadIndex, number | keyof typeof GamepadButton];

type AtomicInputSpec =
  | [type: "key", action: InputKeyboardAction, state?: CombinedInputState]
  | [type: "mouse", action: InputMouseAction, state?: CombinedInputState]
  | [type: "gamepad", action: AtomicGamepadAction, state?: CombinedInputState];

export class AtomicInput implements InputCondition {
  #spec: AtomicInputSpec;
  #state: CombinedInputState;

  constructor(
    type: "key",
    action: InputKeyboardAction,
    state?: CombinedInputState
  );
  constructor(
    type: "mouse",
    action: InputMouseAction,
    state?: CombinedInputState
  );
  constructor(
    type: "gamepad",
    action: AtomicGamepadAction,
    state?: CombinedInputState
  );
  constructor(
    ...spec: AtomicInputSpec
  ) {
    this.#spec = spec;
    this.#state = spec[2] ?? "pressed";
  }

  evaluate(
    input: Input
  ): boolean {
    const [type, action] = this.#spec;

    switch (type) {
      case "key":
        return this.#evaluateKey(
          input,
          action
        );
      case "mouse":
        return this.#evaluateMouse(
          input,
          action
        );
      case "gamepad":
        return this.#evaluateGamepad(
          input,
          action
        );
      default:
        return false;
    }
  }

  reset(): void {
    return;
  }

  bind(
    input: Input
  ): BoundInputCondition {
    return bindInputCondition(this, input);
  }

  #evaluateKey(
    input: Input,
    key: InputKeyboardAction
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
    button: InputMouseAction
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
    [gamepad, button]: AtomicGamepadAction
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
