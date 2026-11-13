# withTimeout

```ts
function withTimeout<TValue>(
  promise: PromiseLike<TValue>,
  timeoutMs: number,
  message: string
): Promise<TValue>;
```

Settles like `promise`, or rejects with `new Error(message)` when
`timeoutMs` passes first. The timer is cleared either way. `promise` itself
is not cancelled: it keeps running after a timeout.

```ts
import { withTimeout } from "@jolly-pixel/utils";

await withTimeout(
  resolver.ready(reference),
  10_000,
  "Asset did not load in time."
);
```
