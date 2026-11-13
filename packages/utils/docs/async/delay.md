# Delays

## `delay()`

```ts
function delay(milliseconds: number): Promise<void>;
```

Resolves after `milliseconds` through `setTimeout`. A delay of `0` or less
resolves right away, without waiting for a timer.

```ts
import { delay } from "@jolly-pixel/utils";

overlay.classList.add("fade-out");
await delay(500);
overlay.remove();
```

## `yieldToEventLoop()`

```ts
function yieldToEventLoop(): Promise<void>;
```

Resolves on a later turn of the event loop: `setImmediate` in Node.js, a
`0` ms `setTimeout` elsewhere. Await it inside a long loop so pending I/O and
timers get a chance to run.
