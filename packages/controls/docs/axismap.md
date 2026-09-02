# AxisMap

`AxisMap` turns held keys, mouse buttons, and gamepad sticks into named
scalar axes sampled once per frame. Sources resolve in `[-1, 1]`; an axis
can exceed that range when the magnitude of its `scale` is greater than `1`.
It replaces the `isDown(...) ? vector.z -= 1` accumulation that movement code
writes by hand.

```ts
import {
  Input,
  Axis,
  AxisMap,
  GamepadAxisSource,
  InputCombination
} from "@jolly-pixel/controls";

const canvas = document.querySelector("canvas");
if (!canvas) {
  throw new Error("No canvas element found");
}

const input = new Input(canvas);
input.connect();

const axes = new AxisMap({
  moveRight: Axis.buttons("KeyD.down", "KeyA.down")
    .or(new GamepadAxisSource(0, "LeftStickX")),
  moveUp: Axis.buttons(
    "Space.down",
    InputCombination.atLeastOne("ShiftLeft.down", "ShiftRight.down")
  ),
  moveForward: Axis.buttons(
    InputCombination.atLeastOne("KeyW.down", "ArrowUp.down"),
    InputCombination.atLeastOne("KeyS.down", "ArrowDown.down")
  ).or(new GamepadAxisSource(
    0,
    "LeftStickY",
    { invert: true }
  ))
});

const direction = { x: 0, y: 0, z: 0 };

function gameLoop() {
  input.update();
  axes.update(input);

  axes.vector3("moveRight", "moveUp", "moveForward", direction);

  requestAnimationFrame(gameLoop);
}

gameLoop();
```

`AxisMap` reports intent only. Speed, smoothing, and normalizing a diagonal
back to unit length stay in the consumer, which knows the units.

## AxisSource

The seam every contributor implements:

```ts
interface AxisSource {
  sample(input: Input): number;
  reset(): void;
}
```

`sample()` must return a finite number in `[-1, 1]`. `Axis` clamps finite
custom source values to that range before resolving competing sources. It
does not validate values outside this contract.

### ButtonAxisSource

```ts
new ButtonAxisSource(
  positive: InputCondition | null,
  negative: InputCondition | null
)
```

The source returns `1` when only the positive condition holds, `-1` when only
the negative one does, and `0` when both or neither do. Pass `null` for a
direction that is never driven.

Because it takes an `InputCondition`, everything
[`InputCombination`](combinedinput.md) builds works as a half, including
alternatives (`KeyW` or `ArrowUp`), chords, and exclusions.

### GamepadAxisSource

```ts
interface GamepadAxisSourceOptions {
  invert?: boolean;
}

new GamepadAxisSource(
  gamepad: GamepadIndex,
  axis: number | keyof typeof GamepadAxis,
  options?: GamepadAxisSourceOptions
)
```

The source reads one stick axis through `Gamepad#axisValue`, so the device's
radial `axisDeadZone` has already been applied. See the
[gamepad axis queries](gamepad.md#axis-queries) for the dead-zone and invalid
index behavior. `axis` can be an index or a `GamepadAxis` name:
`"LeftStickX"`, `"LeftStickY"`, `"RightStickX"`, or `"RightStickY"`.

| Option | Default | Description |
|---|---|---|
| `invert` | `false` | Flips the sign of the raw stick value. The standard mapping reports a stick pushed forward as negative, so a forward axis wants `invert: true`. |

## Axis

One degree of freedom, resolved from one or more sources. When several are
bound, **the source with the largest magnitude wins**. Sources tied at the
largest magnitude combine by direction without increasing the magnitude, so
equal opposing sources cancel.

```ts
type AxisHalf =
  | InputCondition
  | CombinedKeyboardInputAction
  | InputKeyboardAction
  | null;

interface AxisOptions {
  invert?: boolean;
  scale?: number;
}

new Axis(
  sources: Iterable<AxisSource>,
  options?: AxisOptions
)
```

| Option | Default | Description |
|---|---|---|
| `invert` | `false` | Flips the sign of the resolved value. |
| `scale` | `1` | Multiplier applied after `invert`. A negative value reverses the direction. |

`scale` is stored without validation. Non-finite values can produce
non-finite samples.

### Axis.buttons(positive, negative?, options?)

```ts
Axis.buttons(
  positive: AxisHalf,
  negative?: AxisHalf,
  options?: AxisOptions
): Axis
```

Builds a `ButtonAxisSource` axis. A `string` half is read as a keyboard
action. A bare action such as `"KeyW"`, `"ANY"`, or `"NONE"` defaults to the
`down` state because axes are level-triggered. A combined action such as
`"KeyW.pressed"` uses its explicit state. Pass an `InputCondition` for mouse
buttons or composites.

### Axis.gamepadStick(gamepad, axis, options?)

```ts
Axis.gamepadStick(
  gamepad: GamepadIndex,
  axis: number | keyof typeof GamepadAxis,
  options?: AxisOptions
): Axis
```

Builds a one-source gamepad axis. Its `invert` and `scale` options apply once
to the resolved axis.

### axis.or(source)

```ts
axis.or(source: AxisSource): Axis
```

Returns a **new** `Axis` reading from this one's sources plus `source`,
keeping `invert` and `scale`. Pass a `ButtonAxisSource`, `GamepadAxisSource`,
or a custom `AxisSource`. A resolved `Axis` is not a source and cannot nest.

### axis.sample(input)

```ts
axis.sample(input: Input): number
```

Resolves the axis against the current input state. `AxisMap` calls this for
you; call it directly only for a standalone axis.

### axis.resetSources()

```ts
axis.resetSources(): void
```

Resets each source owned by the axis. `AxisMap#reset()` calls this before it
clears the cached value.

## AxisMap

`new AxisMap({ name: axis, ... })` binds a set of named axes. The names are
inferred, so `value()` and the vector helpers only accept bound names.

```ts
type AxisDefinition<TName extends string> = Record<TName, Axis>;

interface Vector2Like {
  x: number;
  y: number;
}

interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

class AxisMap<TName extends string = string> {
  enabled: boolean;

  constructor(definition: AxisDefinition<TName>);

  get names(): Iterable<TName>;
  update(input: Input): void;
  value(name: TName): number;
  vector2<T extends Vector2Like>(
    x: TName,
    y: TName,
    target: T
  ): T;
  vector3<T extends Vector3Like>(
    x: TName,
    y: TName,
    z: TName,
    target: T
  ): T;
  reset(): void;
}
```

`AxisDefinition`, `Vector2Like`, and `Vector3Like` are exported from the
package root.

| Member | Description |
|---|---|
| `enabled` | When `false`, `update()` holds every axis at `0` instead of sampling. Defaults to `true`. |
| `names` | The bound axis names, in definition order. |
| `update(input)` | Samples every axis. Call once per frame, after `Input#update`. |
| `value(name)` | The value cached by the last `update()`. Throws `UnknownAxisError` on an unbound name. |
| `vector2(x, y, target)` | Writes two axis values into `target` and returns it. |
| `vector3(x, y, z, target)` | Writes three axis values into `target` and returns it. |
| `reset()` | Resets every source and clears every cached value to `0`. |

The vector helpers take the target as an out parameter, like `Mouse#scrollTo`,
so a per-frame call allocates nothing. Any `{ x, y }` / `{ x, y, z }` object
works, including a `THREE.Vector3`.

### UnknownAxisError

```ts
class UnknownAxisError extends Error {
  readonly axis: string;

  constructor(axis: string);
}
```

`value()` throws this error when `axis` is not bound. Its message is
`No axis named "<axis>" is bound on this AxisMap.` and `axis` contains the
unknown name.
