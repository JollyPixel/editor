# suspendWhenHidden

Stops a [`GameLoop`](./gameloop.md) while an element is off screen, and starts
it again when the element shows.

**Use it when** a canvas can scroll out of view or sit in a hidden frame.

```ts
import {
  GameLoop,
  suspendWhenHidden,
} from "@jolly-pixel/loop";

const session = new AbortController();
loop.start({ update });
suspendWhenHidden(
  loop,
  canvas,
  session.signal,
);

// later, when you are done with the loop
loop.stop();
session.abort();
```

## Signature

```ts
suspendWhenHidden(loop: GameLoop, target: Element, signal: AbortSignal): void;
```

Aborting `signal` disconnects the helper.

## Behavior

- Hidden: a running loop is stopped.
- Visible again: the loop is restarted with its existing callbacks. The
  scheduler is reset, so there is no catch-up delta.
- It only restarts loops it stopped itself. If you call `loop.start()` while
  the target is hidden, the loop keeps running.

## Gotchas

> [!WARNING]
> Abort the signal when you stop the loop for good. Calling `stop()` on an
> already suspended loop does nothing, so the helper still restarts it once
> `target` shows.

- Needs `IntersectionObserver` on `globalThis`.
