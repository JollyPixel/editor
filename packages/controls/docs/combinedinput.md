# InputCombination

`InputCombination` builds conditions from keyboard, mouse, and gamepad state.
Conditions can represent a single control, a chord, alternatives, exclusions,
or an ordered sequence.

```ts
import {
  Input,
  InputCombination
} from "@jolly-pixel/controls";

const canvas = document.querySelector("canvas");
if (!canvas) {
  throw new Error("No canvas element found");
}

const input = new Input(canvas);
input.connect();

const save = InputCombination.all(
  "ControlLeft.down",
  "KeyS.pressed"
);

const moveUp = InputCombination.atLeastOne(
  "KeyW.down",
  "ArrowUp.down"
);

const selectWithoutShift = InputCombination.all(
  InputCombination.mouse("left", "pressed"),
  InputCombination.none("ShiftLeft.down")
);

function gameLoop() {
  input.update();

  if (save.evaluate(input)) {
    console.log("Save");
  }
  if (moveUp.evaluate(input)) {
    console.log("Move up");
  }
  if (selectWithoutShift.evaluate(input)) {
    console.log("Select");
  }

  requestAnimationFrame(gameLoop);
}

gameLoop();
```

## Condition shape

Every factory result has the following structural interface:

```ts
interface InputCondition {
  evaluate(input: Input): boolean;
  reset(): void;
}
```

`evaluate()` reads the current frame state from `Input`. `reset()` clears
condition-owned progress. Atomic conditions have no progress to clear;
composite conditions forward the reset to their children.

`InputCondition` and the atomic condition types are used by the public
signatures but are not exported from the package root.

## Action types

```ts
type CombinedInputState =
  | "down"
  | "pressed"
  | "released";

type CombinedInputAction =
  `${ExtendedKeyCode | MouseAction}.${CombinedInputState}`;
```

`"down"` remains true while the control is held. `"pressed"` and
`"released"` read the corresponding transition from the latest device
update.

The combined action and state aliases are not exported from the package root.
Factory overloads still validate them at compile time.

## Atomic conditions

### `InputCombination.key()`

```ts
InputCombination.key(
  action: CombinedInputAction
): AtomicInput

InputCombination.key(
  key: ExtendedKeyCode,
  state?: CombinedInputState
): AtomicInput
```

Creates a keyboard condition. The state defaults to `"pressed"`.

```ts
InputCombination.key("Space");
InputCombination.key("KeyW", "down");
InputCombination.key("ShiftLeft.released");
```

### `InputCombination.mouse()`

```ts
InputCombination.mouse(
  action: CombinedInputAction
): AtomicInput

InputCombination.mouse(
  button: MouseAction,
  state?: CombinedInputState
): AtomicInput
```

Creates a mouse button or virtual wheel-button condition. The state defaults
to `"pressed"`.

```ts
InputCombination.mouse("left");
InputCombination.mouse("right", "down");
InputCombination.mouse("scrollUp.pressed");
```

### `InputCombination.gamepad()`

```ts
InputCombination.gamepad(
  gamepad: GamepadIndex,
  button: number | keyof typeof GamepadButton,
  state?: CombinedInputState
): AtomicInput
```

Creates a gamepad button condition. The state defaults to `"pressed"`.

```ts
InputCombination.gamepad(0, "A");
InputCombination.gamepad(0, "LeftBumper", "down");
```

The `AtomicInput` class returned by these methods is not exported from the
package root.

## Combined-action detection

```ts
InputCombination.isCombinedAction(
  action: unknown
): action is CombinedInputAction
```

Returns true when `action` is a string containing a period. It does not
validate the key, mouse action, or state segments.

## Composite conditions

Composite methods accept existing condition objects and combined-action
strings:

```ts
type ConditionArgument =
  | InputCondition
  | CombinedInputAction;
```

The composite signatures below use `ConditionArgument` as a local
documentation alias. It is not exported.

A string passed directly to a composite is always converted with
`InputCombination.key()`. Create mouse and gamepad conditions with their
factories before passing them to a composite.

### `InputCombination.all()`

```ts
InputCombination.all(
  ...conditions: ConditionArgument[]
): AllInputs
```

Returns true when every child returns true during the same evaluation. This is
used for chords and modifier guards. An empty `all()` condition returns true.

```ts
InputCombination.all(
  "ControlLeft.down",
  "ShiftLeft.down",
  "KeyS.pressed"
);
```

### `InputCombination.atLeastOne()`

```ts
InputCombination.atLeastOne(
  ...conditions: ConditionArgument[]
): AtLeastOneInput
```

Returns true when at least one child returns true. An empty condition returns
false.

```ts
InputCombination.atLeastOne(
  "KeyW.down",
  "ArrowUp.down"
);
```

### `InputCombination.none()`

```ts
InputCombination.none(
  ...conditions: ConditionArgument[]
): NoneInputs
```

Returns true when every child returns false. An empty condition returns true.

```ts
InputCombination.none(
  "ShiftLeft.down",
  "ShiftRight.down"
);
```

## Sequences

```ts
InputCombination.sequence(
  ...conditions: ConditionArgument[]
): SequenceInputs

InputCombination.sequenceWithTimeout(
  timeoutMs: number,
  ...conditions: ConditionArgument[]
): SequenceInputs
```

A sequence advances when its current child evaluates to true. Other active
controls do not cancel progress. If the elapsed time since the previous
matched child exceeds the timeout, progress returns to the first child before
the current evaluation.

`sequence()` uses `SequenceInputs.DefaultTimeout`, which defaults to `100`
milliseconds. `sequenceWithTimeout()` uses the supplied interval between
matched steps.

After the final child matches, the sequence returns true once and resets its
progress. Calling `reset()` also resets every child.

```ts
const konami = InputCombination.sequenceWithTimeout(
  500,
  "ArrowUp.pressed",
  "ArrowUp.pressed",
  "ArrowDown.pressed",
  "ArrowDown.pressed"
);
```

## Concrete condition classes

The package root exports the composite implementations:

```ts
new AllInputs(conditions: InputCondition[])
new AtLeastOneInput(conditions: InputCondition[])
new NoneInputs(conditions: InputCondition[])

new SequenceInputs(
  conditions: InputCondition[],
  timeoutMs?: number,
  now?: () => number
)
```

`SequenceInputs.DefaultTimeout` is mutable and defaults to `100`. The
optional clock defaults to `Date.now` and allows deterministic sequence
evaluation.

The factory methods are the practical entry point because `InputCondition`
cannot currently be imported from the package root.
