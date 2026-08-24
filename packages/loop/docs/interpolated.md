# Interpolated

`Interpolated` stores the previous and current fixed-step samples. Call
`push()` after each fixed step and `at(schedule.alpha)` when rendering.

```ts
import { Interpolated, lerpNumber } from "@jolly-pixel/loop";

const height = new Interpolated(0, lerpNumber);

loop.start({
  fixedUpdate: (fixedDeltaMs) => {
    simulate(fixedDeltaMs / 1000);
    height.push(player.y);
  },
  update: (_frameDeltaMs, alpha) => {
    sprite.y = height.at(alpha);
  }
});
```

The lerp is supplied by the caller, so this class carries no knowledge of what
it interpolates:

```ts
export type Lerp<T> = (previous: T, current: T, alpha: number) => T;

export function lerpNumber(
  previous: number,
  current: number,
  alpha: number
): number;

const position = new Interpolated({ x: 0, y: 0 }, (previous, current, alpha) => ({
  x: lerpNumber(previous.x, current.x, alpha),
  y: lerpNumber(previous.y, current.y, alpha)
}));
```

The caller supplies interpolation for other value types. The package has no
`three` dependency.

## Constructor

### `new Interpolated(initial, lerp)`

```ts
new Interpolated<T>(initial: T, lerp: Lerp<T>);
```

Both samples start at `initial`.

## API

| Member | Description |
| --- | --- |
| `previous` | Read-only sample before `current`. |
| `current` | Read-only latest sample. |
| `push(value: T): this` | Shifts `current` to `previous` and stores `value`. |
| `reset(value: T): this` | Replaces both samples. |
| `at(alpha: number): T` | Blends with `alpha` clamped to `[0, 1]`. |

`at()` returns an endpoint without calling the lerp when `alpha <= 0` or
`alpha >= 1`. Interpolated rendering trails simulation by at most one fixed
step.

> [!NOTE]
> Engine-wide transform interpolation requires fixed steps to be the only
> transform writers. Existing components also write transforms in `update()`,
> so automatic interpolation remains out of scope for this package.
