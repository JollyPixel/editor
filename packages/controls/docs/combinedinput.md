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

Every concrete condition class also has `bind(input)`, described in
[Binding to an Input](#binding-to-an-input). It is not part of the
`InputCondition` interface.

`InputCondition`, `AtomicInput`, and the action aliases described below are
exported from the package root.

## Action types

```ts
type CombinedInputState =
  | "down"
  | "pressed"
  | "released";

type CombinedKeyboardInputAction =
  `${ExtendedKeyCode}.${CombinedInputState}`;

type CombinedMouseInputAction =
  `${MouseAction}.${CombinedInputState}`;

type CombinedInputAction =
  | CombinedKeyboardInputAction
  | CombinedMouseInputAction;
```

`"down"` remains true while the control is held. `"pressed"` and
`"released"` read the corresponding transition from the latest device
update.

These action and state aliases are exported from the package root. Keyboard
and mouse actions use separate types so a mouse action cannot reach a keyboard
condition by mistake.

## Atomic conditions

### `InputCombination.key()`

```ts
InputCombination.key(
  action: CombinedKeyboardInputAction
): AtomicInput

InputCombination.key(
  key: InputKeyboardAction,
  state?: CombinedInputState
): AtomicInput
```

Creates a keyboard condition. The state defaults to `"pressed"`.

```ts
InputCombination.key("Space");
InputCombination.key("KeyW", "down");
InputCombination.key("ShiftLeft.released");
InputCombination.key("ANY", "pressed");
InputCombination.key("NONE", "down");
```

`InputKeyboardAction` includes the `"ANY"` and `"NONE"` sentinels. They query
the selected state across the whole keyboard, as described by
[InputActionQuery](inputactionquery.md). Sentinels use the separate `state`
argument; combined forms such as `"ANY.down"` are not part of
`CombinedKeyboardInputAction`.

### `InputCombination.mouse()`

```ts
InputCombination.mouse(
  action: CombinedMouseInputAction
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

The `AtomicInput` class returned by these methods is exported from the package
root.

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
  | CombinedKeyboardInputAction;
```

The composite signatures below use `ConditionArgument` as a local
documentation alias. It is not exported.

A string passed directly to a composite is a keyboard action. Create mouse and
gamepad conditions with their factories before passing them to a composite.

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

`timeoutMs` is used without validation. With the default clock, a negative
value resets progress before each evaluation. `NaN` and `Infinity` prevent
the sequence from expiring. An empty sequence always returns false.

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

### Held steps

```ts
InputCombination.hold(
  key: ExtendedKeyCode
): HoldInput

InputCombination.hold(
  entry: InputCondition,
  sustain: InputCondition
): HoldInput
```

A held step is matched by its `entry` condition and must keep its `sustain`
condition true until the sequence completes. `hold(key)` uses the key's
`"pressed"` state as entry and its `"down"` state as sustain. Mouse, gamepad,
and composite held steps pass both conditions. Calling `hold()` with a
condition but no sustain condition throws a `TypeError`.

```ts
const command = InputCombination.sequenceWithTimeout(
  500,
  InputCombination.hold("ControlLeft"),
  InputCombination.hold("AltLeft"),
  "KeyX.pressed"
);
```

This matches Ctrl, then Alt, then X, with Ctrl and Alt still held when X is
pressed. Pressing Alt before Ctrl does not match.

Held steps change sequence progress as follows:

- Before each evaluation, progress returns to the first matched held step
  whose `sustain` condition is false. That step must be entered again.
- The timeout does not apply while the last matched step is held. It still
  applies after a step that is not held.
- When a held step matches, the next step is evaluated during the same call,
  so held keys pressed in the same frame still match in order. Steps that are
  not held advance once per call.
- On timeout or completion, progress returns to the step after the last held
  step instead of the first step. While Ctrl and Alt stay held, each new X
  press completes the example above again.

Outside a sequence, `HoldInput#evaluate()` returns its `sustain` result.
`reset()` resets both conditions. `HoldInput` is exported from the package
root.

## Binding to an Input

```ts
interface BoundInputCondition {
  (): boolean;
  reset(): void;
}

condition.bind(
  input: Input
): BoundInputCondition

bindInputCondition(
  condition: InputCondition,
  input: Input
): BoundInputCondition
```

`bind()` returns a function that calls `condition.evaluate(input)`. The
bound `reset()` calls `condition.reset()`. `bindInputCondition()` does the
same for any object that implements `InputCondition`, including custom
conditions without a `bind()` method.

```ts
const dash = InputCombination.all(
  InputCombination.key("ShiftLeft", "down"),
  InputCombination.key("ArrowRight", "pressed")
).bind(input);

function gameLoop() {
  input.update();

  if (dash()) {
    console.log("Dash");
  }

  requestAnimationFrame(gameLoop);
}
```

A bound function does not copy the condition. Every function bound from the
same condition shares its state, so a `SequenceInputs` bound to two inputs
advances from both. Call a bound sequence once per frame, as with
`evaluate()`.

`BoundInputCondition` and `bindInputCondition()` are exported from the
package root.

## Concrete condition classes

The package root exports the atomic and composite implementations. The
factory methods above are the shorter way to build them.

```ts
new AtomicInput(
  type: "key",
  action: InputKeyboardAction,
  state?: CombinedInputState
)

new AtomicInput(
  type: "mouse",
  action: MouseAction,
  state?: CombinedInputState
)

new AtomicInput(
  type: "gamepad",
  action: [GamepadIndex, number | keyof typeof GamepadButton],
  state?: CombinedInputState
)
```

The low-level `CombinedInputType` and `AtomicInputAction` unions used by
`AtomicInput` are also exported.

```ts
new AllInputs(conditions: InputCondition[])
new AtLeastOneInput(conditions: InputCondition[])
new NoneInputs(conditions: InputCondition[])
new HoldInput(entry: InputCondition, sustain: InputCondition)

new SequenceInputs(
  conditions: InputCondition[],
  timeoutMs?: number,
  now?: () => number
)
```

`SequenceInputs.DefaultTimeout` is mutable and defaults to `100`. The optional
clock defaults to `Date.now` and allows deterministic sequence evaluation.
