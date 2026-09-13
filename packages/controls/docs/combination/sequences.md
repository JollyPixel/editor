# Sequences and held steps

An input sequence matches conditions in order. Each call to `evaluate()`
checks the current step against the latest `Input` frame state.

```ts
const konami = InputCombination.sequenceWithTimeout(
  500,
  "ArrowUp.pressed",
  "ArrowUp.pressed",
  "ArrowDown.pressed",
  "ArrowDown.pressed"
);
```

Other active controls do not cancel progress. After the final child matches,
the sequence returns true once and resets its progress.

## Construction

```ts
InputCombination.sequence(
  ...conditions: (
    InputCondition | CombinedKeyboardInputAction
  )[]
): SequenceInputs

InputCombination.sequenceWithTimeout(
  timeoutMs: number,
  ...conditions: (
    InputCondition | CombinedKeyboardInputAction
  )[]
): SequenceInputs
```

The factory methods accept `InputCondition` objects and combined keyboard
actions. Create mouse and gamepad steps with `InputCombination.mouse()` and
`gamepad()` before passing them to a sequence.

`SequenceInputs` is also exported for direct construction:

```ts
new SequenceInputs(
  conditions: InputCondition[],
  timeoutMs?: number,
  now?: () => number
)
```

The optional clock defaults to `Date.now`. Supplying a clock is useful when
the caller needs deterministic sequence timing.

An empty sequence always returns false.

## Timeouts

`sequence()` reads `SequenceInputs.DefaultTimeout`, which is mutable and
defaults to `100` milliseconds. `sequenceWithTimeout()` uses the supplied
interval between matched steps.

If the elapsed time since the previous matched child exceeds the timeout,
progress returns to the first child before the current evaluation.

`timeoutMs` is used without validation. With the default clock, a negative
value resets progress before each evaluation. `NaN` and `Infinity` prevent a
sequence from expiring.

## Held steps

A held step has an entry condition that advances the sequence and a sustain
condition that must remain true until the sequence completes.

```ts
InputCombination.hold(
  key: ExtendedKeyCode
): HoldInput

InputCombination.hold(
  entry: InputCondition,
  sustain: InputCondition
): HoldInput
```

`hold(key)` uses the key's `"pressed"` state as its entry and its `"down"`
state as its sustain condition. Mouse, gamepad, and composite held steps pass
both conditions explicitly. Calling `hold()` with a condition but no sustain
condition throws a `TypeError`.

```ts
const command = InputCombination.sequenceWithTimeout(
  500,
  InputCombination.hold("ControlLeft"),
  InputCombination.hold("AltLeft"),
  "KeyX.pressed"
);
```

This sequence matches Ctrl, then Alt, then X, with Ctrl and Alt still held
when X is pressed. Pressing Alt before Ctrl does not match.

Held steps affect sequence progress in several ways:

- Before evaluation, progress returns to the first matched held step whose
  sustain condition is false. That step must be entered again.
- A timeout does not apply while the last matched step is held. It applies
  after a step that is not held.
- After a held step matches, the next step is evaluated during the same call.
  Held keys pressed in the same frame can therefore match in order. A step
  that is not held advances at most once per call.
- On timeout or completion, progress returns to the step after the last held
  step. While Ctrl and Alt remain held, each new X press completes the example
  again.

Outside a sequence, `HoldInput#evaluate()` returns its sustain result.
`reset()` resets both its entry and sustain conditions.

`HoldInput` can also be constructed directly:

```ts
new HoldInput(
  entry: InputCondition,
  sustain: InputCondition
)
```

## Resetting and binding

Calling `SequenceInputs#reset()` returns progress to the first step and resets
every child condition. Completion also resets sequence progress, using the
held-step resume behavior described above.

Like every concrete condition, a sequence can be bound to an `Input`. A bound
sequence still owns mutable progress, so call it once per frame and avoid
sharing the same sequence between independent bindings.

See [Binding to an Input](input-conditions.md#binding-to-an-input) for the
bound function contract.
