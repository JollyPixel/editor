# Frame scheduling and performance

Runtime exposes its `GameLoop` as `runtime.loop`. The loop owns one
`FrameScheduler` and calls `world.tick(schedule)` once per rendered frame.

## Configure the loop

Pass initial scheduler options to `Runtime.create()` or configure the scheduler
before startup:

```ts
const runtime = await Runtime.create("canvas", {
  loop: {
    fixedFps: 60,
    maxFps: 144
  }
});
```

```ts
runtime.loop.scheduler.fixedFps = 60;
runtime.loop.scheduler.maxFps = 144;
runtime.loop.timeScale = 0.5;
```

`fixedFps` controls the simulation rate. `maxFps` caps rendering independently
of that rate. Set `timeScale` to `0` to pause simulation time without stopping
the runtime.

The [`GameLoop` reference](../../../loop/docs/gameloop.md) covers scheduling,
pause state, and frame-source behavior.

## Control startup device settings

`runtime.load()` uses GPU detection to choose a render cap and pixel ratio. Pass
`maxFps` when the application has its own cap:

```ts
await runtime.load({
  scene: new GameScene(),
  maxFps: 144
});
```

Use `Infinity` to remove the detected render cap. This option overrides
`runtime.loop.scheduler.maxFps` during startup.

## Show performance statistics

Set `includePerformanceStats` to `true` to mount the default HUD in the
top-left corner:

```ts
const runtime = await Runtime.create("canvas", {
  includePerformanceStats: true
});
```

Choose the other supported corner with `position`:

```ts
const runtime = await Runtime.create("canvas", {
  includePerformanceStats: {
    position: "top-right"
  }
});
```

The top-right HUD follows viewport resizes. The HUD is removed by
`runtime.dispose()`.

Pass `mount: false` when application code will display or consume the recorder:

```ts
const runtime = await Runtime.create("canvas", {
  includePerformanceStats: {
    mount: false
  }
});

const recorder = runtime.stats;
```

See the [`StatsRecorder` reference](../../../ui/docs/api/stats/stats-recorder.md)
for the recorder API.
