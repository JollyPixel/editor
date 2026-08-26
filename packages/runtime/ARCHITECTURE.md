# Architecture

The runtime package connects a browser host to the synchronous engine world. It
owns renderer construction, asynchronous startup, asset preparation, browser
input bindings, and the game loop.

## Project structure

```
src/
├── assets/                Asset composition and scene preparation
├── bootstrap/             Startup workflow and device configuration
├── ui/                    Lit components and bootstrap UI adapters
├── Runtime.ts             Renderer, input bindings, and game-loop ownership
└── index.ts               Public barrel exports
```

`index.ts` contains exports only. Each public implementation lives in the file
that owns its behavior.

## Responsibilities

`Runtime` creates the renderer, world, asset coordinator, and runtime scene
loader. It also owns browser listeners that remain active for the runtime
session. `start()` installs those listeners and starts the animation loop;
`stop()` removes them and disconnects the world.

The `bootstrap` folder contains one-time startup work. `loadRuntime()` composes
the workflow, while `configureRuntimeDevice()` applies the GPU-derived frame
rate and pixel ratio. Its `maxFps` option overrides that frame rate, which
hosts targeting a desktop display are expected to set. Startup UI details stay
behind `RuntimeLoadingScreen`, so the bootstrap function does not manipulate
Lit elements or canvas styles.

`SceneManager` owns scene requests and their visible state. The internal
`RuntimeSceneLoader` uses `AssetCoordinator` for I/O and reports progress back
through the engine's scene-load driver.

## Bootstrap sequence

```
loadRuntime(runtime)
 │
 ├─ mount RuntimeLoadingScreen
 │
 ├─ run concurrently
 │   ├─ start loading-screen animation
 │   ├─ configure runtime device
 │   └─ wait for the minimum loading delay
 │
 ├─ load explicit assets
 ├─ request the initial scene through SceneManager
 │   └─ RuntimeSceneLoader reports scene asset progress
 │
 ├─ queue the prepared scene
 ├─ complete the loading screen
 └─ runtime.start()
```

An initialization failure is shown by the loading screen and rethrown to the
caller. The runtime does not start after a failed bootstrap.

## Runtime lifecycle

```
Runtime.create(canvas)
 │
 ├─ create ThreeRenderer
 ├─ create AssetCoordinator and World
 └─ install RuntimeSceneLoader into SceneManager

Runtime.start()
 │
 ├─ focus canvas and install input listeners
 ├─ connect and start World
 └─ setAnimationLoop(world.tick)

Runtime.stop()
 │
 ├─ stop animation loop and World
 ├─ remove input listeners
 └─ disconnect World
```

The ECS lifecycle remains synchronous. `SceneManager.loadScene()` returns its
state immediately, while `RuntimeSceneLoader` completes the platform I/O in the
background. Scene activation still occurs at `beginFrame()`.

## Pixel-ratio strategy

The runtime limits high-DPI rendering cost with a device-specific cap:

| Device  | Maximum pixel ratio |
| ------- | ------------------- |
| Desktop | 1                   |
| Mobile  | 1.5                 |

The applied ratio is the lower of the cap and `window.devicePixelRatio`.
Mobile detection comes from `detect-gpu`.
