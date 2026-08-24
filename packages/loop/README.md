<h1 align="center">
  loop
</h1>

<p align="center">
  Frame scheduling and time primitives (FrameScheduler, GameLoop)
</p>

## 💃 Getting Started

This package is available in the Node Package Repository and can be easily installed with [npm][npm] or [yarn][yarn].

```bash
$ npm i @jolly-pixel/loop
# or
$ yarn add @jolly-pixel/loop
```

## 👀 Usage example

```ts
import { GameLoop } from "@jolly-pixel/loop";

const loop = new GameLoop({ fixedFps: 60, maxFps: 144 });

loop.on("panic", ({ droppedMs }) => {
  console.warn(`the frame overran its budget, dropped ${droppedMs}ms`);
});

loop.start({
  fixedUpdate: (fixedDeltaMs, stepIndex) => {
    world.step(fixedDeltaMs / 1000, stepIndex);
  },
  update: (frameDeltaMs, alpha) => {
    renderer.draw(alpha);
  }
});
```

for a host with its own frame pump:

```ts
import { FrameScheduler } from "@jolly-pixel/loop";

const scheduler = new FrameScheduler({ fixedFps: 60 });

function tick(now: number) {
  const schedule = scheduler.advance(now);

  for (let stepIndex = 0; stepIndex < schedule.steps; stepIndex++) {
    world.step(schedule.fixedDelta / 1000, stepIndex);
  }
  if (schedule.render) {
    renderer.draw(schedule.alpha);
  }
}
```

Tests drive either layer without timers:

```ts
import { GameLoop, ManualFrameSource } from "@jolly-pixel/loop";

const source = new ManualFrameSource();
const loop = new GameLoop({ source });

loop.start({ fixedUpdate, update });
source.run([16, 16, 5000, 16]);
```

## 📚 API

- [FrameScheduler](./docs/framescheduler.md): the scheduler and the `FrameSchedule` it returns.
- [GameLoop](./docs/gameloop.md): the facade, its callbacks and its events.
- [FrameSource](./docs/framesource.md): the driver seam, plus `RafFrameSource` and `ManualFrameSource`.
- [Clock](./docs/clock.md): `PerformanceClock` and `ManualClock`.
- [Interpolated](./docs/interpolated.md): rendering between two fixed steps.
- [FrameBudget](./docs/framebudget.md): a deadline for optional per-frame work.

See [GLOSSARY.md](./GLOSSARY.md) for the timing terms used by the package.

## 🐌 Lag policy

The scheduler limits lag in two stages.

| Option | Default | Meaning |
| --- | --- | --- |
| `fixedFps` | `60` | Simulation rate. Fixed, never adapted. |
| `maxFps` | `Infinity` | Render cap. Independent of `fixedFps`. |
| `maxFrameDelta` | `250` | The raw delta is clamped to this before accumulating. |
| `maxStepsPerFrame` | `5` | Upper bound on fixed steps per frame. |
| `timeScale` | `1` | Multiplier applied to the frame delta. `0` pauses. |

A tab switch, a breakpoint or a laptop waking up produces one enormous delta.
`maxFrameDelta` absorbs it and the frame reports `clamped: true`.

An overloaded frame wants more steps than its budget allows. The scheduler runs
`maxStepsPerFrame` of them and **discards** the rest, reporting `panicked: true`
with `droppedMs`. Simulation time falls behind wall-clock time, the game slows
down, and the loop cannot spiral, because unrun work is never carried forward.

A capped frame still accumulates time and still runs its fixed steps. Only
`render` comes back `false`, because a source that swallowed frames would hide
their elapsed time from the accumulator.

## ✨ Contributors guide

If you are a developer **looking to contribute** to the project, you must first read the [CONTRIBUTING][contributing] guide.

Once you have finished your development, check that the tests (and linter) are still good by running the following script:

```bash
$ npm run test
$ npm run lint
```

> [!CAUTION]
> In case you introduce a new feature or fix a bug, make sure to include tests for it as well.

## 📃 License

MIT

<!-- Reference-style links for DRYness -->

[npm]: https://docs.npmjs.com/getting-started/what-is-npm
[yarn]: https://yarnpkg.com
[emitt]: https://github.com/OpenAlly/npm-packages/tree/main/src/emitt
[contributing]: ../../CONTRIBUTING.md
