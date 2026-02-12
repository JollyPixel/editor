## CombinedInput

Declarative input combination system that lets you compose complex input
conditions from simple building blocks. Build key chords, alternative
bindings, exclusion lists, and input sequences using a fluent API
powered by the `InputCombination` factory.

```ts
import { InputCombination, Input } from "@jolly-pixel/engine";

const canvas = document.querySelector("canvas")!;
const input = new Input(canvas);
input.connect();

// Single key press
const jump = InputCombination.key("Space");

// Ctrl + S chord (both must be active)
const save = InputCombination.all("ControlLeft.down", "KeyS.pressed");

// WASD or Arrow keys (any one triggers it)
const moveUp = InputCombination.atLeastOne("KeyW.down", "ArrowUp.down");

// Left-click only when Shift is NOT held
const selectSingle = InputCombination.all(
  InputCombination.mouse("left", "pressed"),
  InputCombination.none("ShiftLeft.down")
);

// Konami-style sequence
const combo = InputCombination.sequence(
  "ArrowUp.pressed",
  "ArrowUp.pressed",
  "ArrowDown.pressed",
  "ArrowDown.pressed"
);

function gameLoop() {
  input.update();

  if (jump.evaluate(input)) {
    console.log("Jump!");
  }
  if (save.evaluate(input)) {
    console.log("Save!");
  }
  if (moveUp.evaluate(input)) {
    console.log("Moving up");
  }
  if (selectSingle.evaluate(input)) {
    console.log("Single select");
  }
  if (combo.evaluate(input)) {
    console.log("Combo activated!");
  }

  requestAnimationFrame(gameLoop);
}

gameLoop();
```

### InputCondition Interface

Every condition returned by `InputCombination` implements this interface:

```ts
interface InputCondition {
  evaluate(input: Input): boolean;
  reset(): void;
}
```

#### `evaluate(input): boolean`

Returns `true` when the condition is satisfied for the current frame.

#### `reset()`

Reset internal state (relevant for stateful conditions like sequences).

### InputCombination

Static factory class used to create all input conditions.

### Atomic Conditions

#### `InputCombination.key(action)`

Create a keyboard condition from a combined action string.

```ts
InputCombination.key("Space.pressed");
InputCombination.key("KeyW.down");
InputCombination.key("ShiftLeft.released");
```

#### `InputCombination.key(key, state?)`

Create a keyboard condition with an explicit key code and state.
Defaults to `"pressed"` when `state` is omitted.

```ts
InputCombination.key("Space");
InputCombination.key("KeyW", "down");
```

#### `InputCombination.mouse(action)`

Create a mouse button condition from a combined action string.

```ts
InputCombination.mouse("left.pressed");
InputCombination.mouse("right.down");
```

#### `InputCombination.mouse(button, state?)`

Create a mouse button condition with an explicit button and state.
Defaults to `"pressed"` when `state` is omitted.

```ts
InputCombination.mouse("left");
InputCombination.mouse("right", "down");
```

#### `InputCombination.gamepad(gamepad, button, state?)`

Create a gamepad button condition. Defaults to `"pressed"` when `state`
is omitted.

```ts
InputCombination.gamepad(0, "A");
InputCombination.gamepad(0, "LeftBumper", "down");
```

### Composite Conditions

#### `InputCombination.all(...conditions)`

Returns a condition that is satisfied when **all** child conditions are
satisfied simultaneously. Useful for key chords and modifier combinations.

Accepts `InputCondition` objects or `CombinedInputAction` shorthand strings.

```ts
// Ctrl + Shift + S
InputCombination.all("ControlLeft.down", "ShiftLeft.down", "KeyS.pressed");

// Mixed condition objects and strings
InputCombination.all(
  InputCombination.mouse("left", "pressed"),
  "ShiftLeft.down"
);
```

#### `InputCombination.atLeastOne(...conditions)`

Returns a condition that is satisfied when **at least one** child condition
is satisfied. Useful for alternative bindings.

```ts
// Accept either WASD or Arrow key
InputCombination.atLeastOne("KeyW.down", "ArrowUp.down");
```

#### `InputCombination.none(...conditions)`

Returns a condition that is satisfied when **none** of the child conditions
are satisfied. Useful for exclusion guards.

```ts
// True only when neither Shift key is held
InputCombination.none("ShiftLeft.down", "ShiftRight.down");
```

#### `InputCombination.sequence(...conditions)`

Returns a condition that is satisfied when all child conditions are triggered
**in order** within a default timeout (100 ms between each step).

```ts
InputCombination.sequence(
  "ArrowUp.pressed",
  "ArrowDown.pressed",
  "ArrowUp.pressed"
);
```

#### `InputCombination.sequenceWithTimeout(timeoutMs, ...conditions)`

Same as `sequence` but with a custom timeout between each step.

```ts
InputCombination.sequenceWithTimeout(
  500,
  "KeyA.pressed",
  "KeyB.pressed",
  "KeyC.pressed"
);
```

### Types

```ts
type CombinedInputState = "down" | "pressed" | "released";

type CombinedInputAction =
  `${ExtendedKeyCode | MouseAction}.${CombinedInputState}`;

type MouseAction =
  | "left" | "middle" | "right"
  | "back" | "forward"
  | "scrollUp" | "scrollDown";

type GamepadIndex = 0 | 1 | 2 | 3;

type GamepadButton =
  | "A" | "B" | "X" | "Y"
  | "LeftBumper" | "RightBumper"
  | "LeftTrigger" | "RightTrigger"
  | "Select" | "Start"
  | "LeftStick" | "RightStick"
  | "DPadUp" | "DPadDown" | "DPadLeft" | "DPadRight"
  | "Home";
```

### State Meanings

| State | Meaning |
| ------------ | ---------------------------------------- |
| `"down"` | `true` while the button/key is held |
| `"pressed"` | `true` only on the frame it was pressed |
| `"released"` | `true` only on the frame it was released |
