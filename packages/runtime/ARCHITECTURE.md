# Runtime architecture

`RuntimeCore` puts a backend's world in a browser page. It drives the world
from a scheduled game loop and owns what surrounds the canvas: focus, loading
screen, overlay and metrics. It imports no renderer and no ECS.

## What the runtime composes

```mermaid
flowchart TB
    App["Application"] --> Core["RuntimeCore"]
    Core --> Backend["RuntimeBackend<br/>world, frame source, metrics"]
    Core --> Loop["GameLoop<br/>@jolly-pixel/loop"]
    Core --> UI["Loading screen, overlays, metrics<br/>@jolly-pixel/ui"]
    Three["Runtime<br/>@jolly-pixel/backend.three"] -->|"extends"| Core
```

- The backend brings the world and its scenes; `RuntimeCore` only sees the
  structural `RuntimeWorld` in `src/contract/`.
- `startup/` loads, `session/` holds what `start()` attaches, `metrics/` the
  HUD and panel, `overlay/` the HTML layer.
- Nothing here imports three.js; pnpm's isolated `node_modules` make a stray
  import fail typecheck.

## Startup

```mermaid
flowchart TB
    Load["runtime.load(options)"] --> Rate["Set the FPS cap"]
    Rate --> Skip{"skipLoadingScreen?"}
    Skip -->|"no"| Screen["Mount the loading screen"]
    Skip -->|"yes"| Show["Show the canvas"]
    Screen --> Device["Cap the pixel ratio"]
    Show --> Device
    Device --> Entrance["Screen entrance and minimum delay,<br/>when a screen is mounted"]
    Entrance --> Batch["Load the startup assets"]
    Batch --> Scene["backend.loadScene(scene)"]
    Scene --> Complete["Complete the loading screen"]
    Complete --> Start["runtime.start()"]
```

- The FPS cap is `maxFps`, or none. `RuntimeCore.load()` sets it, and without
  `maxFps` also creates a `FrameRateGovernor` that every frame of `start()`
  feeds before the world ticks.
- Any failure rejects `load()`, leaves the runtime stopped, and is shown on
  the screen when one is mounted.

## Frame path

```mermaid
sequenceDiagram
    participant Source as Backend frame source
    participant Scheduler as GameLoop
    participant Core as RuntimeCore
    participant World as Backend world

    Source->>Scheduler: frame callback
    Scheduler->>Core: frame(schedule)
    Core->>World: tick(schedule), timed by runtime.stats
    World-->>Core: exit requested?
    opt exit requested
        Core->>Core: stop()
    end
```

- `FrameScheduler`, inside `GameLoop`, decides the fixed step count and
  whether to render.
- With `renderOnDemand`, the loop sleeps until page activity or a world
  `invalidate` event wakes it.

## Metrics

```mermaid
flowchart TB
    Backend["Backend metrics<br/>runtime.metrics.renderer"] --> Recorder["StatsRecorder<br/>runtime.stats"]
    Sources["Other sources<br/>runtime.stats.addSource()"] --> Recorder
    Frames["Every frame<br/>stats.begin() and stats.end()"] --> Recorder
    Recorder --> HUD["Corner HUD"]
    Recorder --> Panel["Readout panel"]
```

One recorder feeds every display. The recorder and the counters exist even
when nothing is mounted.

## Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Stopped: constructed
    Stopped --> Running: start() or successful load()
    Running --> Stopped: stop() or world exit
    Stopped --> Disposed: dispose()
    Running --> Disposed: dispose()
    Disposed --> [*]
```

- `start()` attaches the focus listeners and hint, then starts the backend and
  the loop; `stop()` releases them. Both are idempotent.
- The overlay layer never takes pointer events; the loading screen mounts
  outside it.

Details: [RuntimeCore](./docs/api/RuntimeCore.md),
[metrics](./docs/api/RuntimeMetrics.md) and
[overlay layer](./docs/api/OverlayLayer.md).
