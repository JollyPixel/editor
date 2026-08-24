# Clock

`Clock` supplies monotonic wall-clock time in milliseconds.

```ts
export interface Clock {
  now(): number;
}
```

`FrameScheduler` receives timestamps through `advance(now)`. Frame sources and
`FrameBudget` use clocks directly.

## PerformanceClock

`PerformanceClock` reads `performance.now()`. It is the default clock for
`FrameBudget`.

```ts
import { PerformanceClock } from "@jolly-pixel/loop";

const clock = new PerformanceClock();
clock.now();
```

## ManualClock

`ManualClock` changes only when `set()` or `advance()` is called.

```ts
import { ManualClock } from "@jolly-pixel/loop";

const clock = new ManualClock();     // starts at 0
clock.advance(16);                   // -> 16
clock.advance(5000);                 // -> 5016
clock.set(0);                        // -> 0
```

`new ManualClock(initialTime?: number)` starts at `initialTime` when supplied
and at `0` otherwise. `set(time)` assigns an absolute time, while
`advance(deltaMs)` adds to the current value. Both methods return the result.

`ManualFrameSource` owns a `ManualClock`; `FrameBudget` accepts one through its
constructor.
