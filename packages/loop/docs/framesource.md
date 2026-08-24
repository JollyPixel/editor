# FrameSource

`FrameSource` supplies frame timestamps without applying a frame-rate cap.

```ts
export type FrameCallback = (now: number) => void;

export interface FrameSource {
  start(callback: FrameCallback): void;
  stop(): void;
}
```

`now` uses the source's timebase, is measured in milliseconds, and may be
emitted synchronously from `start()`. Calling `start()` again must replace the
previous subscription.

> [!IMPORTANT]
> A source must never swallow frames to cap the frame rate. Dropped frames hide
> their elapsed time from the accumulator, so a 30fps cap built this way
> delivers fixed steps in bursts of two. Capping is `maxFps` on
> [`FrameScheduler`](./framescheduler.md).

The built-in sources differ in two ways:

- **Restarting.** `start()` on an already-started source may restart it
  (`RafFrameSource`) or simply replace the callback (`ManualFrameSource`). It
  must not leak the previous subscription either way.
- **Priming frame.** A source may emit one frame synchronously from `start()`
  (`ManualFrameSource` does) or wait for its pump (`RafFrameSource`). Hosts
  tolerate both: `FrameScheduler` reports a zero delta for whichever frame
  lands first.

The `setAnimationLoop()` adapter is in `@jolly-pixel/runtime`. This package has
no `three` dependency.

## RafFrameSource

The browser source. Both animation frame functions are injectable, so its tests
need no DOM shim.

```ts
import { RafFrameSource } from "@jolly-pixel/loop";

const source = new RafFrameSource();
```

```ts
export interface RafFrameSourceOptions {
  // Defaults to globalThis.requestAnimationFrame
  requestAnimationFrame?: (callback: (now: number) => void) => number;
  // Defaults to globalThis.cancelAnimationFrame
  cancelAnimationFrame?: (handle: number) => void;
}
```

`new RafFrameSource(options?: RafFrameSourceOptions)` uses the global animation
frame functions by default and throws `TypeError` if either is unavailable.
The read-only `running` property reports whether a frame is scheduled.

`start(callback)` cancels any pending handle before scheduling the next frame.
Calling `stop()` cancels that handle. Each tick schedules its successor before
invoking the callback, so a thrown callback does not stop future frames.

There is no `visibilitychange` handler. `requestAnimationFrame` pauses in a
hidden document, and `maxFrameDelta` limits the return frame.

## ManualFrameSource

A source driven by a `ManualClock`. It emits frames only when started, stepped,
or given a tape to run.

```ts
import { GameLoop, ManualFrameSource } from "@jolly-pixel/loop";

const source = new ManualFrameSource();
const loop = new GameLoop({ source });

loop.start({ fixedUpdate, update });
source.step(16);              // one 16ms frame
source.run([100, 16, 16]);    // one hitch, then two normal frames
```

`new ManualFrameSource(clock?: ManualClock)` creates a source with a new
`ManualClock` by default. Its read-only `clock` and `running` properties expose
the current clock and subscription state.

`start(callback)` registers the callback and immediately emits the clock's
current time. `step(deltaMs = 0)` advances the clock, emits one frame, and
returns the new time. `run(tape)` accepts `number[]` or `FrameTape`.

`FrameTape` is a named tape: `{ name, description, options, deltas }`, where
`deltas` are the raw millisecond frame deltas and `options` are the
`FrameSchedulerOptions` the tape expects. The package ships none; the test suite
and the demos share their own in `fixtures/scenarios.ts`.

`step()` throws when the source is stopped. `stop()` clears the callback.
