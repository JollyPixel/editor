// Import Internal Dependencies
import type {
  MouseAction,
  InputMouseAction,
  GamepadIndex,
  GamepadButton,
  ExtendedKeyCode,
  InputKeyboardAction
} from "../devices/index.ts";
import type {
  CombinedInputAction,
  CombinedKeyboardInputAction,
  CombinedMouseInputAction,
  CombinedInputState
} from "./types.ts";
import {
  AtomicInput,
  AllInputs,
  AtLeastOneInput,
  NoneInputs,
  HoldInput,
  SequenceInputs,
  AliasedKeyInput,
  type InputCondition
} from "./conditions/index.ts";
import { isApplePlatform } from "../platform.ts";

const kCombinedInputStates = new Set<string>([
  "down",
  "pressed",
  "released"
]);

export class InputCombination {
  static readonly Control = new AliasedKeyInput(["ControlLeft", "ControlRight"]);
  static readonly Shift = new AliasedKeyInput(["ShiftLeft", "ShiftRight"]);
  static readonly Alt = new AliasedKeyInput(["AltLeft", "AltRight"]);
  static readonly Meta = new AliasedKeyInput(["MetaLeft", "MetaRight"]);
  static readonly Mod = new AliasedKeyInput(
    () => (isApplePlatform() ?
      ["MetaLeft", "MetaRight"] :
      ["ControlLeft", "ControlRight"]
    )
  );
  static readonly Enter = new AliasedKeyInput(["Enter", "NumpadEnter"]);
  static readonly MoveUp = new AliasedKeyInput(["KeyW", "ArrowUp"]);
  static readonly MoveDown = new AliasedKeyInput(["KeyS", "ArrowDown"]);
  static readonly MoveLeft = new AliasedKeyInput(["KeyA", "ArrowLeft"]);
  static readonly MoveRight = new AliasedKeyInput(["KeyD", "ArrowRight"]);

  static isCombinedAction(
    action: unknown
  ): action is CombinedInputAction {
    if (typeof action !== "string") {
      return false;
    }

    const separator = action.indexOf(".");

    return separator > 0 &&
      kCombinedInputStates.has(action.slice(separator + 1));
  }

  static key(
    key: CombinedKeyboardInputAction
  ): AtomicInput;
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
      key,
      state
    );
  }

  static mouse(
    button: CombinedMouseInputAction
  ): AtomicInput;
  static mouse(
    button: InputMouseAction,
    state?: CombinedInputState
  ): AtomicInput;
  static mouse(
    button: InputMouseAction | CombinedMouseInputAction,
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
      button,
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

  static hold(
    key: ExtendedKeyCode
  ): HoldInput;
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
