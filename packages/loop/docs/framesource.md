# FrameSource

Supplies frame timestamps to a [`GameLoop`](./gameloop.md).

## Pick a source

| Source | Use it for |
| --- | --- |
| [`RequestAnimationFrameSource`](./sources/requestanimationframesource.md) | Browsers. The `GameLoop` default. |
| [`AnimationLoopFrameSource`](./sources/animationloopframesource.md) | Renderers with `setAnimationLoop()`, such as three.js or WebXR. |
| [`ManualFrameSource`](./sources/manualframesource.md) | Tests and replays. You decide when frames happen. |

## Interface

Implement it to plug in your own frame pump.

```ts
export type FrameCallback = (
  now: number
) => void;

export interface FrameSource {
  start(
    callback: FrameCallback
  ): void;
  stop(): void;
}
```

Rules for an implementation:

- `now` is in milliseconds, on whatever timebase the source uses.
- `start()` may call `callback` synchronously.
- Calling `start()` again replaces the previous callback. Never leak it.

> [!IMPORTANT]
> Never skip frames to cap the frame rate. Skipped frames hide their time from
> the scheduler, so a 30fps cap built this way runs fixed steps in pairs. Cap
> with [`maxFps`](./framescheduler.md#options) instead.
