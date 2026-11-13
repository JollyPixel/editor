# Teardown

Collects release steps while something is being built, then runs them in
reverse. `Teardown` runs synchronous steps and hands out an `AbortSignal`;
`AsyncTeardown` awaits each step.

```ts
import { Teardown } from "@jolly-pixel/utils";

const teardown = new Teardown();
window.addEventListener("resize", onResize, { signal: teardown.signal });
const observer = new ResizeObserver(onResize);
observer.observe(canvas);
teardown.defer(() => observer.disconnect());

// later
teardown.run();
```

```ts
import { AsyncTeardown } from "@jolly-pixel/utils";

const teardown = new AsyncTeardown();
try {
  const server = await openServer();
  teardown.defer(() => server.close());

  return await openRooms(server);
}
catch (error) {
  return teardown.unwind(error);
}
```

```ts
class Teardown {
  get signal(): AbortSignal;

  defer(step: () => void): void;
  run(): void;
  unwind(error: unknown): never;
}

class AsyncTeardown {
  defer(step: () => unknown): void;
  run(): Promise<void>;
  unwind(error: unknown): Promise<never>;
}
```

- `defer` adds a step. Steps run once, last added first. Once a `Teardown`
  has run, `defer` runs the step at once and lets a failure throw, so a
  resource that finishes loading after a dispose is still released.
- `run` runs every step, even after one throws. A single failure is rethrown
  as is; several are thrown as one `AggregateError`, in run order.
- `unwind(error)` runs the steps like `run`, then rethrows `error`. When steps
  also failed, it throws an `AggregateError` carrying `error` first and
  `error`'s message. Call it from the `catch` of a build that failed halfway;
  with `Teardown`, write `throw teardown.unwind(error)` so TypeScript sees the
  `catch` end.
- `Teardown.signal` aborts when the steps start. Read after that, it is
  already aborted.
