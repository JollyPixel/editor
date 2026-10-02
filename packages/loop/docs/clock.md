# Clock

Returns the current time in milliseconds.

```ts
export interface Clock {
  now(): number;
}
```

Used by [`FrameBudget`](./framebudget.md) and
[`ManualFrameSource`](./sources/manualframesource.md).

## PerformanceClock

Reads `performance.now()`. The default clock of `FrameBudget`.

```ts
import { PerformanceClock } from "@jolly-pixel/loop";

const clock = new PerformanceClock();
clock.now();
```

## ManualClock

Moves only when you tell it to. For tests.

```ts
import { ManualClock } from "@jolly-pixel/loop";

const clock = new ManualClock();     // starts at 0
clock.advance(16);                   // -> 16
clock.advance(5000);                 // -> 5016
clock.set(0);                        // -> 0
```

| Member | Meaning |
| --- | --- |
| `new ManualClock(initialTime = 0)` | Starts at `initialTime`. |
| `set(time): number` | Jumps to `time`, returns it. |
| `advance(deltaMs): number` | Adds `deltaMs`, returns the new time. |
