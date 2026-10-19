# Input conditions

Every object built by `InputCombination` implements `InputCondition`:

```ts
interface InputCondition {
  evaluate(input: InputDevices): boolean;
  reset(): void;
}

interface InputDevices {
  readonly keyboard: Keyboard;
  readonly mouse: Mouse;
  readonly gamepad: Gamepad;
}
```

`evaluate()` reads the current frame state from the devices. An `Input`
satisfies `InputDevices`. `reset()` clears
condition-owned progress. Atomic conditions have no progress to clear;
composite conditions forward the reset to their children.

`InputCondition` and every concrete condition class on this page are exported
from the package root.

## AtomicInput

The `InputCombination.key()`, `mouse()`, and `gamepad()` factories return an
`AtomicInput`. It can also be constructed directly:

```ts
new AtomicInput(
  type: "key",
  action: InputKeyboardAction,
  state?: CombinedInputState
)

new AtomicInput(
  type: "mouse",
  action: InputMouseAction,
  state?: CombinedInputState
)

new AtomicInput(
  type: "gamepad",
  action: [GamepadIndex, number | keyof typeof GamepadButton],
  state?: CombinedInputState
)
```

The state defaults to `"pressed"`. `evaluate()` delegates to the matching
keyboard, mouse, or gamepad query on `Input`.

The package also exports the low-level `CombinedInputType` and
`AtomicInputAction` unions used by this class.

For the factory overloads and combined action strings, see
[`InputCombination`](../combinedinput.md).

## Composite conditions

The three stateless composites accept an array of child conditions:

```ts
new AllInputs(conditions: InputCondition[])
new AtLeastOneInput(conditions: InputCondition[])
new NoneInputs(conditions: InputCondition[])
```

`AllInputs` returns true when every child evaluates to true. With no children,
it returns true.

`AtLeastOneInput` returns true when any child evaluates to true. With no
children, it returns false.

`NoneInputs` returns true when every child evaluates to false. With no
children, it returns true.

The corresponding `InputCombination.all()`, `atLeastOne()`, and `none()`
factories also accept combined keyboard action strings and convert them into
atomic conditions.

Calling `reset()` on a composite resets each child. Its evaluation stops as
soon as the result is known, so later children may not be evaluated during
that call.

Stateful composition is provided by
[`SequenceInputs` and `HoldInput`](sequences.md).

## Binding to an Input

```ts
interface BoundInputCondition {
  (): boolean;
  reset(): void;
}

bindInputCondition(
  condition: InputCondition,
  input: InputDevices
): BoundInputCondition
```

The returned function calls `condition.evaluate(input)`. Its `reset()` method
calls `condition.reset()`. Any `InputCondition` can be bound, including a
custom implementation.

```ts
const dash = bindInputCondition(
  InputCombination.all(
    InputCombination.key("ShiftLeft", "down"),
    InputCombination.key("ArrowRight", "pressed")
  ),
  input
);

function gameLoop() {
  input.update();

  if (dash()) {
    console.log("Dash");
  }

  requestAnimationFrame(gameLoop);
}
```

A bound function does not copy the condition. Functions bound from the same
condition share its state. A `SequenceInputs` instance bound to two inputs,
for example, advances when either function evaluates it. Call a bound
sequence once per frame, as with `evaluate()`.

`BoundInputCondition` and `bindInputCondition()` are exported from the package
root.
