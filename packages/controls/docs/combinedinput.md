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
  InputCombination.Mod,
  "KeyS.pressed"
);

const moveUp = InputCombination.MoveUp;

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

Every factory returns an [`InputCondition`](combination/input-conditions.md).
A condition can be evaluated directly or bound to an `Input` as a function.
Stateful conditions, including sequences, also expose `reset()`.

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

These types are exported from the package root. Keyboard and mouse actions
use separate types so a mouse action cannot reach a keyboard condition by
mistake.

## Keyboard conditions

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

## Mouse conditions

```ts
InputCombination.mouse(
  action: CombinedMouseInputAction
): AtomicInput

InputCombination.mouse(
  button: InputMouseAction,
  state?: CombinedInputState
): AtomicInput
```

Creates a mouse button or virtual wheel-button condition. The state defaults
to `"pressed"`. `InputMouseAction` also accepts a button index and the
`"ANY"` and `"NONE"` sentinels, which use the separate `state` argument.

```ts
InputCombination.mouse("left");
InputCombination.mouse("right", "down");
InputCombination.mouse("scrollUp.pressed");
InputCombination.mouse("ANY", "down");
```

## Gamepad conditions

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

The [`AtomicInput`](combination/input-conditions.md#atomicinput) class returned
by these methods is exported from the package root.

## Combined-action detection

```ts
InputCombination.isCombinedAction(
  action: unknown
): action is CombinedInputAction
```

Returns true when `action` is a string whose segment after the first period is
a `CombinedInputState`. It does not validate the key or mouse action segment.

## Composite conditions

Composite methods accept existing condition objects and combined keyboard
actions:

```ts
type ConditionArgument =
  | InputCondition
  | CombinedKeyboardInputAction;
```

`ConditionArgument` is used here to shorten the signatures. It is not
exported. A string passed directly to a composite is a keyboard action. Create
mouse and gamepad conditions with their factories before passing them to a
composite.

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

The concrete composite classes and their direct constructors are documented
with the [condition API](combination/input-conditions.md#composite-conditions).

## Predefined combinations

`InputCombination` provides aliases for paired modifier keys, Enter, and
common movement keys. A preset reads the `"down"` state; its `pressed` and
`released` properties expose group transitions.

See [AliasedKeyInput and predefined
combinations](combination/aliased-key-input.md) for the available presets and
the transition rules for an alias family.

## Sequences

`sequence()` and `sequenceWithTimeout()` match ordered input. A sequence may
also contain held steps that must remain active until later steps complete.

See [Sequences and held steps](combination/sequences.md) for timeout, rollback,
completion, and reset behavior.

## Binding conditions

Every concrete condition has `bind(input)`, which returns a callable condition
for the supplied `Input`. The package also exports `bindInputCondition()` for
custom implementations of `InputCondition`.

See [Binding to an Input](combination/input-conditions.md#binding-to-an-input)
for the bound function contract and state-sharing behavior.
