# Runtime architecture

`Runtime` is the browser-facing composition layer for the engine. It creates a
renderer and world for a canvas, connects asset loading to scene loading, and
drives the world through a scheduled game loop. The web and Electron guides use
the same runtime code.

## Workspace map

```mermaid
flowchart TB
    App["Application<br/>canvas · options · scenes"]
    Catalog[("Asset catalog")]
    Files[("Asset files")]

    subgraph RuntimePackage["@jolly-pixel/runtime"]
        Runtime["Runtime<br/>create · load · start · stop · dispose"]
        Bootstrap["bootstrapRuntime<br/>device · startup assets · initial scene"]
        Assets["AssetCoordinator<br/>catalog · loader registry"]
        SceneLoader["RuntimeSceneLoader"]
        Loop["GameLoop<br/>FrameScheduler"]
        FrameSource["AnimationLoopFrameSource"]
        Overlay["OverlayLayer<br/>HUD · focus hint"]
        Screen["RuntimeLoadingScreen"]
        Metrics["StatsRecorder · RuntimeMetrics"]
    end

    subgraph Engine["@jolly-pixel/engine"]
        World["World<br/>input · audio · context"]
        SceneManager["SceneManager"]
        Renderer["ThreeRenderer"]
    end

    App --> Runtime
    Runtime --> Bootstrap
    Runtime --> Assets
    Runtime --> World
    Runtime --> Loop
    Runtime --> Overlay
    Runtime --> Metrics
    Bootstrap --> Screen
    Catalog --> Assets
    Assets -->|"asset references"| Files
    Bootstrap -->|"loadBatch"| Assets
    Bootstrap -->|"loadScene"| SceneManager
    SceneManager -->|"scene assets"| SceneLoader
    SceneLoader --> Assets
    World --> SceneManager
    World --> Renderer
    Loop --> FrameSource
    FrameSource -->|"setAnimationLoop"| Renderer
    Loop -->|"FrameSchedule"| World
    Renderer -->|"draw event"| Metrics
```

The package owns the wiring. `World` owns engine services, `SceneManager` owns
scene state, `AssetCoordinator` owns catalog-based loading, and `GameLoop` owns
frame scheduling. Runtime also creates a shared Three.js `LoadingManager` for
its default and custom asset loaders.

| Boundary | Runtime's role | Owner of the underlying behavior |
|---|---|---|
| Canvas and renderer | Resolve the canvas and create `ThreeRenderer` | Engine renderer |
| Assets | Resolve a catalog, register loaders, and install `RuntimeSceneLoader` | `@jolly-pixel/asset` and `SceneManager` |
| Frames | Adapt renderer animation callbacks and pass schedules to `world.tick()` | `@jolly-pixel/loop` and `World` |
| Browser UI | Mount the loading screen, overlays, and optional readouts | Runtime and `@jolly-pixel/ui` |

## Creation and startup

```mermaid
sequenceDiagram
    participant App as Application
    participant Runtime
    participant Catalog as Asset catalog
    participant Renderer as ThreeRenderer
    participant World
    participant Loader as RuntimeSceneLoader
    participant Screen as Loading screen
    participant GPU as GPU detection
    participant Assets as AssetCoordinator
    participant Scenes as SceneManager

    App->>Runtime: create(canvas, options)
    Runtime->>Runtime: resolve canvas
    Runtime->>Catalog: use instance, fetch URL, or create empty catalog
    Catalog-->>Runtime: AssetCatalog
    Runtime->>Renderer: create(canvas)
    Runtime->>Assets: register default and custom loaders
    Runtime->>World: construct(renderer, sceneManager, assets)
    Runtime->>Loader: install on SceneManager
    Runtime-->>App: runtime

    App->>Runtime: load(startup assets, initial scene)
    Runtime->>Screen: mount
    par startup entrance
        Runtime->>Screen: start entrance
    and
        Runtime->>GPU: detect tier, set FPS cap and pixel ratio
    and
        Runtime->>Screen: wait minimum loading delay
    end
    Runtime->>Assets: loadBatch(startup assets)
    Assets-->>Runtime: progress
    Runtime->>Screen: update progress
    opt initial scene supplied
        Runtime->>Scenes: loadScene(scene)
        Scenes->>Loader: load scene assets
        Loader->>Assets: loadBatch(scene.assets)
        Loader-->>Scenes: progress, then ready or failed
        Scenes-->>Runtime: sceneLoadChanged
    end
    Runtime->>Screen: complete
    Runtime->>World: connect and start
    Runtime->>Runtime: start GameLoop
    Runtime-->>App: load resolves
```

The screen entrance, GPU detection, and minimum delay run together. Startup
assets load next; the optional initial scene's assets load after them. With
`skipLoadingScreen`, the canvas is shown immediately and device configuration,
assets, and scene preparation run in the same order without a screen or delay.
An asset or scene failure rejects `load()` and prevents `start()`. When a screen
is mounted, it displays the error.

The initial scene can be `ready` when `load()` resolves without yet being
active. `SceneManager` activates ready scenes in `beginFrame()` on the next
world tick. Its progress and status are reported through `sceneLoadChanged`;
`RuntimeSceneLoader` forwards batch progress from `AssetCoordinator`.

## Frame path

```mermaid
sequenceDiagram
    participant Renderer as Three.js renderer
    participant Source as AnimationLoopFrameSource
    participant Loop as GameLoop / FrameScheduler
    participant Runtime
    participant Stats as StatsRecorder
    participant World
    participant Scenes as SceneManager

    Renderer->>Source: animation callback(time)
    Source->>Loop: frame time
    Loop->>Loop: advance schedule
    Loop->>Runtime: frame(schedule)
    Runtime->>Stats: begin()
    Runtime->>World: tick(schedule)
    World->>Scenes: beginFrame() / activate ready scenes
    loop scheduled fixed steps
        World->>World: update input
        World->>Scenes: fixedUpdate(fixedDelta)
    end
    opt schedule.render
        World->>Scenes: update(frameDelta, alpha)
        World->>Renderer: draw(scene)
        Renderer-->>Runtime: draw event / capture renderer counters
    end
    World->>Scenes: endFrame()
    World-->>Runtime: exit requested?
    Runtime->>Stats: end()
    opt exit requested
        Runtime->>Runtime: stop()
    end
```

The loop uses the renderer's `setAnimationLoop()` through
`AnimationLoopFrameSource`. `FrameScheduler` decides the fixed step count and
whether to render. `World.tick()` updates input even when there are no fixed
steps, and draws only when `schedule.render` is true. Runtime records each
scheduled frame; the renderer's draw event captures draw calls and triangle
counts for `RuntimeMetrics`.

## Lifetime and browser surfaces

```mermaid
stateDiagram-v2
    [*] --> Created: Runtime.create resolves
    Created --> Running: start() or successful load()
    Running --> Stopped: stop() or input exit
    Stopped --> Running: start() or successful load()
    Created --> Disposed: dispose()
    Running --> Disposed: dispose()
    Stopped --> Disposed: dispose()
    Disposed --> [*]
```

`start()` focuses the canvas, mounts enabled focus and view helpers, connects
the world, and starts the loop. `stop()` stops the world and loop, disconnects
input and resize observation, and removes running-only helpers and focus
listeners. Both methods are idempotent. `dispose()` also removes the HUD,
metrics panel, overlay layer, and renderer resources; the instance must not be
reused.

The overlay layer follows the canvas by default or fills a supplied container.
It holds the optional performance HUD and focus hint. The view helper draws
inside the renderer's canvas after frames. `StatsRecorder` and `RuntimeMetrics`
exist even when no HUD or panel is mounted.

Details: [runtime API](./docs/api/Runtime.md),
[asset options](./docs/api/runtime-assets.md),
[scenes and assets](./docs/guides/scenes-and-assets.md),
[loading screen](./docs/guides/loading-screen.md), and
[frame scheduling and performance](./docs/guides/frame-scheduling-and-performance.md).
