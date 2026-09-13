# AliasedKeyInput and predefined combinations

`AliasedKeyInput` treats several physical keys as one logical key. The
`InputCombination` presets use it for paired modifiers, alternate Enter keys,
and movement controls that accept either a letter key or an arrow key.

```ts
const save = InputCombination.all(
  InputCombination.Mod,
  "KeyS.pressed"
);

const confirm = InputCombination.Enter.pressed;
const moveUp = InputCombination.MoveUp;
```

## Modifier presets

`InputCombination.Control`, `Shift`, `Alt`, and `Meta` combine the left and
right form of the corresponding modifier.

`InputCombination.Mod` uses the Meta keys on Apple platforms and the Control
keys elsewhere. It reads `navigator.platform` when its keys are first needed
and caches the result. Without a `navigator`, it uses the Control keys.

A chord built from a modifier preset does not exclude other modifiers. This
condition also matches Ctrl+Shift+S:

```ts
const save = InputCombination.all(
  InputCombination.Control,
  "KeyS.pressed"
);
```

Use `none()` when the additional modifiers must be rejected:

```ts
const saveOnly = InputCombination.all(
  InputCombination.Mod,
  InputCombination.none(
    InputCombination.Shift,
    InputCombination.Alt
  ),
  "KeyS.pressed"
);
```

## Enter and movement presets

`InputCombination.Enter` combines `Enter` and `NumpadEnter`.

The movement presets combine a physical letter key with its matching arrow:

- `MoveUp` uses `KeyW` and `ArrowUp`.
- `MoveDown` uses `KeyS` and `ArrowDown`.
- `MoveLeft` uses `KeyA` and `ArrowLeft`.
- `MoveRight` uses `KeyD` and `ArrowRight`.

The `Move*` presets use physical key codes, so they follow key position on
non-QWERTY layouts.

## Construction

```ts
type AliasedKeys =
  | readonly ExtendedKeyCode[]
  | (() => readonly ExtendedKeyCode[]);

class AliasedKeyInput implements InputCondition {
  readonly state: CombinedInputState;

  get keys(): KeyCode[];
  get down(): AliasedKeyInput;
  get pressed(): AliasedKeyInput;
  get released(): AliasedKeyInput;

  constructor(
    keys: AliasedKeys,
    state?: CombinedInputState
  );
}
```

The state defaults to `"down"`. Shorthands such as `"w"` resolve to their
`KeyCode`, and duplicate keys are removed. `keys` returns a copy.

The constructor also accepts a resolver function. The resolver runs on the
first evaluation or `keys` read, and its result is cached. This allows `Mod`
to select its keys only when it is first used.

`AliasedKeyInput` and `AliasedKeys` are exported from the package root.

## Group transitions

An alias reports transitions for the whole group:

- `down` is true while at least one key is held.
- `pressed` is true on the frame the first key goes down while no other key
  was held.
- `released` is true on the frame the last held key goes up.

Pressing a second key while the first is held produces no group transition.
Swapping keys within one frame also produces no transition. Use separate
atomic conditions when either physical key should report its own edge:

```ts
const eitherShiftPressed = InputCombination.atLeastOne(
  "ShiftLeft.pressed",
  "ShiftRight.pressed"
);
```

The condition evaluates through `Keyboard#isDown()`, `wasJustPressed()`, and
`wasJustReleased()`. Its `down` state therefore matches a `key(code, "down")`
condition for each resolved key.

The `down`, `pressed`, and `released` properties return the same member on
every read and share the resolved key list. For a condition whose state is
`"down"`, `condition.pressed.down === condition`.

`reset()` does nothing because an aliased condition keeps no progress. Like
the other concrete conditions, it can be bound to an `Input`:

```ts
const isShiftHeld = InputCombination.Shift.bind(input);

if (isShiftHeld()) {
  console.log("Shift is held");
}
```

See [Input conditions](input-conditions.md) for `evaluate()`, `reset()`, and
the bound condition contract.
