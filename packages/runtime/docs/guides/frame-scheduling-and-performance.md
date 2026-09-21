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

The runtime always records. `runtime.stats` is a `StatsRecorder` the loop
brackets around every frame, and `runtime.metrics` is where metrics are
registered. `includePerformanceStats` only decides what is displayed.

Set it to `true` to mount the default HUD in the top-left corner of the
canvas:

```ts
const runtime = await Runtime.create("canvas", {
  includePerformanceStats: true
});
```

Choose another anchor with `position` and the edge distance with `inset`:

```ts
const runtime = await Runtime.create("canvas", {
  includePerformanceStats: {
    position: "top-right",
    inset: 12
  }
});
```

The HUD is mounted through `runtime.overlay`, so it follows the canvas when the
canvas moves or resizes. See [overlays](../api/Runtime.md#overlays) to mount it
inside a container element instead. The HUD is removed by `runtime.dispose()`.

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

## Record what a subsystem counts

The HUD cycles one metric at a time. Anything a subsystem counts joins it
through `runtime.metrics`, as a source describing its own metrics:

```ts
const release = runtime.metrics.addSource(engine.inspector);
```

Hold `release` whenever the subsystem is torn down before the runtime is,
because a metric left behind keeps sampling it.

A source is anything carrying a `metrics` array of
[metric definitions](../../../ui/docs/api/stats/metric-definition.md). Each
definition names its own `label`, the `unit` a display formats it with, and the
`group` a readout files it under, so nothing downstream repeats them.

The renderer's own counters are registered by the runtime, under the
`renderer` group.

## Show a full readout

A HUD showing one metric at a time is not a readout. Add a panel listing every
registered metric, grouped as the definitions describe:

```ts
const runtime = await Runtime.create("canvas", {
  includePerformanceStats: {
    panel: {
      title: "Performance [F3]",
      toggleKey: "F3",
      hidden: true
    }
  }
});
```

The panel floats by default. To put it in a dock, or to merge it into a pane
the application already owns, mount it once the pane exists and give it a
target:

```ts
const panel = await runtime.mountMetricsPanel({
  target: inspectorPane,
  toggleKey: "F3"
});
```

An `HTMLElement` target receives a pane of its own; a facade container takes
the folders directly. Metrics registered after the panel is mounted join it on
their own, so the order between mounting and `addSource()` does not matter.

A readout that should stay a window, yet be dockable, targets the
`jolly-dock-layout` with `floating`:

```ts
const panel = await runtime.mountMetricsPanel({
  target: document.querySelector("jolly-dock-layout"),
  floating: true,
  key: "performance",
  toggleKey: "F3",
  hidden: true
});
```

The layout then owns the window, so it can be dragged into any of its docks or
merged into a pane group as a tab. Without a layout target the pane floats
under `document.body`, where no layout can accept it.

Add controls of your own beside the rows through `panel.container`:

```ts
panel.container
  .addFolder({ title: "inspector" })
  .addBinding(inspector, "chunkBounds", { label: "chunk bounds" });
```

A metric belonging in the readout but not in the corner HUD sets `tile: false`
on its definition, which keeps the HUD cycle short.
