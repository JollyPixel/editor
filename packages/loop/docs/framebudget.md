# FrameBudget

`FrameBudget` tracks a wall-clock deadline for optional work such as queue
draining. It is independent of `FrameScheduler.maxStepsPerFrame` and the
scheduler's panic state.

```ts
import { FrameBudget } from "@jolly-pixel/loop";

const budget = new FrameBudget();

budget.start(4);
while (queue.length > 0 && !budget.expired) {
  rebuild(queue.shift());
}
```

## Constructor

### `new FrameBudget(clock)`

```ts
new FrameBudget(clock?: Clock);
```

The constructor uses `PerformanceClock` by default and accepts a `ManualClock`
for tests.

## Properties

| Property | Description |
| --- | --- |
| `budget` | Milliseconds granted by the last `start()`. |
| `elapsed` | Milliseconds since the last `start()`, or `0` when cleared. |
| `remaining` | Milliseconds left, clamped to `0`. |
| `expired` | `true` before `start()` and once the deadline is reached. |

## API

`start(budgetMs: number): this` starts a deadline at the clock's current time.
It throws `RangeError` when `budgetMs` is negative or non-finite.

`clear(): this` resets the budget and makes it expired.

A budget of `0` expires immediately. A fresh or cleared budget is also expired,
so optional work should only run after `start()`.
