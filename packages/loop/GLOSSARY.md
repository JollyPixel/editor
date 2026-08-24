# Loop glossary

Terms used throughout the loop package.

## Vocabulary

### Frame

One call to `FrameScheduler.advance(now)`. A frame can run zero or more fixed
steps. The render cap may prevent it from being drawn.

### Raw delta

Non-negative wall-clock time since the previous frame, in milliseconds. It is
measured before clamping and time scaling and is returned as `rawDelta`.

### Frame delta

The raw delta after clamping and time scaling, in milliseconds. It is added to
the accumulator and passed to `update()` as `frameDeltaMs`.

### Fixed delta

The constant simulation timestep, `1000 / fixedFps` milliseconds. Every fixed
step receives this value.

### Fixed step

One call to `fixedUpdate`. A frame runs at most `maxStepsPerFrame` fixed steps.

### Accumulator

Unconsumed simulation time. Each frame adds `frameDelta`; each fixed step
subtracts `fixedDelta`. It remains below one fixed delta after scheduling. A
panic resets it to zero after recording the dropped time.

### Alpha

The accumulator divided by the fixed delta, in `[0, 1)`. Pass it to
`Interpolated.at()` to render between the previous and current fixed-step
samples.

### Clamp

Capping `rawDelta` at `maxFrameDelta` before time scaling. The schedule reports
`clamped: true`.

### Panic

Requesting more fixed steps than `maxStepsPerFrame` allows. The scheduler runs
the permitted steps, discards the remaining accumulator, and reports
`panicked: true`. `GameLoop` emits a `panic` event.

### Drop

Simulation time discarded by a panic. `FrameSchedule.droppedMs` reports the
current frame's drop. `FrameScheduler.droppedTime` accumulates drops since the
last reset.

### Spiral of death

An overload cycle in which pending simulation work grows faster than it can be
processed. Dropping excess accumulator time breaks the cycle.

### Time scale

A multiplier applied after clamping and before accumulation. `2` doubles
simulation speed, `0.5` halves it, and `0` stops simulation time. Render pacing
uses the unscaled wall-clock delta.

### Render cap

`maxFps`, the upper bound on drawing. A capped frame still accumulates time and
runs fixed steps; its schedule sets `render` to `false`.

### Frame source

The driver that supplies frame timestamps. `RafFrameSource` uses
`requestAnimationFrame`; `ManualFrameSource` advances under caller control.

### Schedule

The `FrameSchedule` returned by `advance()`. It records the deltas, fixed-step
count, interpolation alpha, render decision, and lag flags for one frame.

### Frame budget

A deadline for optional work within a frame. `FrameBudget` measures elapsed and
remaining wall-clock time. `FrameScheduler.maxStepsPerFrame` controls the
fixed-step limit that can trigger a panic.
