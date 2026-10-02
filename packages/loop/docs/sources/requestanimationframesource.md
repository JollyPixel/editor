# RequestAnimationFrameSource

Browser [`FrameSource`](../framesource.md) built on `requestAnimationFrame`.
`GameLoop` uses it when you pass no `source`.

```ts
import { RequestAnimationFrameSource } from "@jolly-pixel/loop";

const source = new RequestAnimationFrameSource();
```

## Options

```ts
new RequestAnimationFrameSource(options?: RequestAnimationFrameSourceOptions);
```

| Option | Default |
| --- | --- |
| `requestAnimationFrame` | `globalThis.requestAnimationFrame` |
| `cancelAnimationFrame` | `globalThis.cancelAnimationFrame` |

Pass your own pair to drive it in tests without a DOM. Throws `TypeError` when
either function is missing.

## Members

| Member | Meaning |
| --- | --- |
| `running` | Read-only. A frame is scheduled. |
| `start(callback)` | Cancels any pending frame, then schedules the next one. The first frame waits for the browser. |
| `stop()` | Cancels the pending frame. |

## Behavior

- A callback that throws does not stop the source: the next frame is already
  scheduled.
- No `visibilitychange` handling. Browsers pause `requestAnimationFrame` in
  hidden tabs, and `maxFrameDelta` clamps the first frame back.
