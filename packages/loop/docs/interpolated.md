# Interpolated

Keeps the last two fixed-step values so rendering can blend between them.

**Use it when** motion stutters because the render rate and `fixedFps` differ.

```ts
import {
  Interpolated,
  lerpNumber,
} from "@jolly-pixel/loop";

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

1. `push()` after each fixed step.
2. `at(alpha)` when rendering.

The rendered value lags the simulation by up to one fixed step.

## Constructor

```ts
new Interpolated<T>(initial: T, lerp: Lerp<T>);
```

Both stored values start at `initial`.

## Members

| Member | Meaning |
| --- | --- |
| `previous` | Read-only. The value before `current`. |
| `current` | Read-only. The latest value. |
| `push(value): this` | `current` becomes `previous`, `value` becomes `current`. |
| `reset(value): this` | Sets both to `value`. Use it on teleports. |
| `at(alpha): T` | Blends the two. `alpha <= 0` returns `previous`, `alpha >= 1` returns `current`, without calling `lerp`. |

## Lerp

You supply the blend function, so any type works.

```ts
export type Lerp<T> = (previous: T, current: T, alpha: number) => T;
```

`lerpNumber` covers numbers. Compose it for other shapes:

```ts
const position = new Interpolated({ x: 0, y: 0 }, (previous, current, alpha) => ({
  x: lerpNumber(previous.x, current.x, alpha),
  y: lerpNumber(previous.y, current.y, alpha)
}));
```
