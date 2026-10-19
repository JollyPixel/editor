// Import Internal Dependencies
import type { InputDevices } from "../../types.ts";
import type {
  InputMouseAction,
  GamepadIndex,
  GamepadButton,
  InputKeyboardAction
} from "../../devices/index.ts";
import type { InputCondition } from "./InputCondition.ts";
import type { CombinedInputState } from "../types.ts";

export type CombinedInputType =
  | "key"
  | "mouse"
  | "gamepad";

export type AtomicInputAction =
  | InputKeyboardAction
  | InputMouseAction
  | AtomicGamepadAction;

type AtomicGamepadAction = [
  GamepadIndex,
  number | keyof typeof GamepadButton
];

type AtomicKeySpec = [
  type: "key",
  action: InputKeyboardAction,
  state?: CombinedInputState
];

type AtomicMouseSpec = [
  type: "mouse",
  action: InputMouseAction,
  state?: CombinedInputState
];

type AtomicGamepadSpec = [
  type: "gamepad",
  action: AtomicGamepadAction,
  state?: CombinedInputState
];

type AtomicInputSpec =
  | AtomicKeySpec
  | AtomicMouseSpec
  | AtomicGamepadSpec;

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
    input: InputDevices
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

  #evaluateKey(
    input: InputDevices,
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
    input: InputDevices,
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
    input: InputDevices,
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
