# FrameBudget

A time limit for optional work inside one frame.

**Use it when** you drain a queue (mesh rebuilds, uploads) and want to stop
after a few milliseconds.

```ts
import { FrameBudget } from "@jolly-pixel/loop";

const budget = new FrameBudget();

budget.start(4);
while (queue.length > 0 && !budget.expired) {
  rebuild(queue.shift());
}
```

It has no link to the scheduler. `maxStepsPerFrame` and panics are unaffected.

## Constructor

```ts
new FrameBudget(clock?: Clock);
```

Defaults to a [`PerformanceClock`](./clock.md#performanceclock). Pass a
[`ManualClock`](./clock.md#manualclock) in tests.

## Methods

| Method | What it does |
| --- | --- |
| `start(budgetMs): this` | Starts a deadline `budgetMs` from now. Throws `RangeError` when negative or not finite. |
| `clear(): this` | Drops the deadline. The budget is expired again. |

## Properties

| Property | Meaning |
| --- | --- |
| `budget` | Milliseconds given to the last `start()`. |
| `elapsed` | Milliseconds since `start()`. `0` after `clear()`. |
| `remaining` | Milliseconds left, never below `0`. |
| `expired` | Deadline reached. |

## Gotchas

- A new or cleared budget is **already expired**. Call `start()` first, or the
  loop above runs nothing.
- `start(0)` expires immediately.
