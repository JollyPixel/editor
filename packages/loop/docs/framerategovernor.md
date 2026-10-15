# FrameRateGovernor

Halves the render rate while frames keep missing their display refresh, then
retries the full rate.

**Use it when** the machine almost keeps up with the display. A frame that
sometimes fits in one refresh and sometimes takes two makes every render
advance by an uneven number of steps. Rendering on every other refresh
advances by the same number of steps each time.

```ts
import { FrameRateGovernor, GameLoop } from "@jolly-pixel/loop";

const loop = new GameLoop({
  snapTolerance: 2
});
const governor = new FrameRateGovernor(loop.scheduler);

governor.on("change", ({ halved, maxFps }) => {
  console.info(`rendering at ${maxFps}fps, halved: ${halved}`);
});

loop.start({
  frame: (schedule) => governor.observe(schedule),
  fixedUpdate,
  update
});
```

It changes `scheduler.maxFps` and nothing else. Fixed steps keep running on
every frame.

## Constructor

```ts
new FrameRateGovernor(
  scheduler: FrameScheduler,
  options?: FrameRateGovernorOptions
);

interface FrameRateGovernorOptions {
  // Share of rendered frames that must miss within one window. In (0, 1].
  missRatio?: number; // 0.25
  // Measurement window, in ms.
  window?: number; // 2000
  // Time at half rate before retrying the full rate, in ms.
  retryDelay?: number; // 5000
  // Upper bound of the doubled retryDelay, in ms. >= retryDelay.
  maxRetryDelay?: number; // 120000
}
```

Throws `RangeError` when an option is out of range.

## Methods

### `observe(schedule: FrameSchedule): void`

Call it once per frame with the scheduler's `FrameSchedule`. It does nothing
until `scheduler.refreshPeriod` is known.

### `reset(): void`

Puts back the `maxFps` it replaced and forgets the retry history.

## Properties

```ts
interface FrameRateGovernor {
  readonly halved: boolean;
}
```

## Events

```ts
type FrameRateGovernorEvents = {
  change: (payload: { halved: boolean; maxFps: number; }) => void;
};
```

## Behavior

- A rendered frame misses when its `unscaledRenderDelta` is above 1.5 times
  the expected interval, the larger of `refreshPeriod` and `1000 / maxFps`.
- When `missRatio` of the rendered frames in one `window` miss, `maxFps`
  becomes half the refresh rate. A single hitch counts as one miss.
- After `retryDelay` at half rate, it restores the previous `maxFps` for one
  window. If that window misses again, it halves again and doubles
  `retryDelay`, up to `maxRetryDelay`. A window that holds resets the delay.
- It never halves when `maxFps` is already at or below half the refresh rate.
- Windows and delays are measured in `unscaledDelta`. A clamped hitch counts as
  `maxFrameDelta`, and time keeps counting while the game is paused.

## Gotchas

- Setting `scheduler.maxFps` while halved is overwritten on the next retry.
