# Architecture

This document describes how the `@jolly-pixel/runtime` package is structured
and how its components interact during the lifecycle of a game session.

## Project structure

```
src/
├── index.ts               Entry point — exports Runtime and loadRuntime
├── Runtime.ts             Core runtime class (game loop, renderer, clock)
├── components/
│   └── Loading.ts         <jolly-loading> Lit web component
└── utils/
    ├── getDevicePixelRatio.ts   Pixel-ratio helper (mobile vs desktop)
    └── timers.ts                Promise-based setTimeout wrapper
```

## High-level overview

The runtime sits between the **host environment** (browser or Electron)
and the **engine** (`@jolly-pixel/engine`). It is responsible for:

1. Creating a Three.js renderer bound to a `<canvas>`
2. Detecting GPU capabilities and adapting quality
3. Displaying a loading screen while assets are fetched
4. Running the update/render loop at a target frame rate

```
┌─────────────────────────────────────────────────┐
│                 Host environment                │
│            (Browser / Electron shell)           │
└────────────────────┬────────────────────────────┘
                     │  provides <canvas>
                     ▼
┌─────────────────────────────────────────────────┐
│                   loadRuntime()                 │
│  ┌───────────┐  ┌────────────┐  ┌────────────┐  │
│  │  detect-  │  │  <jolly-   │  │   Assets   │  │
│  │    gpu    │  │  loading>  │  │   loader   │  │
│  └─────┬─────┘  └─────┬──────┘  └──────┬─────┘  │
│        │              │                │        │
│        ▼              ▼                ▼        │
│  ┌──────────────────────────────────────────┐   │
│  │                Runtime                   │   │
│  │  ┌────────────────────────────────────┐  │   │
│  │  │          World              │  │   │
│  │  │  (SceneEngine + ThreeRenderer)     │  │   │
│  │  └────────────────────────────────────┘  │   │
│  │  THREE.Clock ─── tick() ─── stats.js     │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## Bootstrap sequence

`loadRuntime()` orchestrates the full startup. Below is the ordered
sequence of operations:

```
loadRuntime(runtime)
 │
 ├─ 1. Start GPU detection ─────────────── getGPUTier()  (async, runs in parallel)
 │
 ├─ 2. Hide canvas ─────────────────────── opacity: 0
 │
 ├─ 3. Mount <jolly-loading> ───────────── Lit web component
 │     └─ start()                          begins fade-in animation
 │
 ├─ 4. Wait loadingDelay ───────────────── default 850 ms
 │
 ├─ 5. Await GPU tier result
 │     ├─ setFps(fps)                      clamp 1–60
 │     ├─ setPixelRatio(ratio)             mobile vs desktop cap
 │     └─ tier < 1 → throw                 GPU too weak
 │
 ├─ 6. Load assets ─────────────────────── Systems.Assets.loadAssets()
 │     └─ onProgress → loading bar         tracks loaded / total
 │
 ├─ 7. Complete loading screen
 │     ├─ progress bar fills ──────────── 400 ms animation
 │     ├─ fade-out ────────────────────── 500 ms
 │     └─ remove <jolly-loading>
 │
 └─ 8. Start runtime ──────────────────── runtime.start()
       ├─ canvas opacity: 1               fade-in with CSS transition
       ├─ world.connect()
       └─ setAnimationLoop(tick)           game loop begins
```

> On any error during steps 5–8, the loading screen displays the error
> message and stack trace instead.

## Game loop

The `Runtime.tick` callback is called by Three.js via `setAnimationLoop`.
It implements a **fixed-timestep** pattern capped at the target FPS:

```
setAnimationLoop(tick)
 │
 └─ tick()
     │
     ├─ deltaTime += clock.getDelta()
     │
     ├─ if deltaTime < interval (1/fps)
     │   └─ skip frame (wait for next call)
     │
     └─ if deltaTime >= interval
         ├─ stats.begin()
         ├─ world.update(deltaTime)
         │   └─ returns true → runtime.stop()
         ├─ world.render()
         ├─ deltaTime %= interval
         └─ stats.end()
```

The loop stops when:
- `world.update()` signals an exit
- `runtime.stop()` is called manually

## Loading screen

The `<jolly-loading>` element is a [Lit](https://lit.dev/) web component
registered as a custom element. It manages three visual states:

```
  ┌────────────┐      setProgress()       ┌────────────┐
  │  Loading   │ ─────────────────────▶  │  Progress  │
  │  (started) │      setAsset()          │    bar     │
  └────────────┘                          └─────┬──────┘
                                                │
                                          complete()
                                                │
                                                ▼
                                          ┌────────────┐
                                          │  Fade-out  │
                                          │  + remove  │
                                          └────────────┘

                 error()
  ┌────────────┐ ─────────────────────▶  ┌────────────┐
  │  any state │                         │   Error    │
  └────────────┘                         │  message   │
                                         └────────────┘
```

The progress bar features a shimmer animation and a velocity-based
"speed blur" effect when assets load quickly.

## Pixel-ratio strategy

The runtime caps the device pixel ratio to avoid performance issues on
high-DPI screens:

| Device  | Max pixel ratio |
| ------- | --------------- |
| Desktop | 1               |
| Mobile  | 1.5             |

The actual ratio used is `Math.min(cap, window.devicePixelRatio)`.
Mobile detection comes from the `detect-gpu` library.
