# Plan: Replace Lit.js Loading Screen with Three.js Splash Screen

**Branch:** `refactor-runtime-loading`
**Packages touched:** `@jolly-pixel/runtime`, `@jolly-pixel/engine` (read-only reference)

---

## 1. Goal & Motivation

The current loading screen is a Lit.js web component (`<jolly-loading>`) that lives entirely
outside Three.js — it is an HTML/CSS overlay appended to `document.body`. This creates several
problems:

- **Extra dependency.** `lit` is a non-trivial addition to a library that otherwise has no web
  component framework dependency.
- **Disconnected from the engine.** Progress, errors and the completion state are fed via
  imperative method calls (`setProgress`, `error`, `complete`) with no integration into the engine's
  scene/actor lifecycle.
- **Not customizable.** There is no extension point. Game developers cannot substitute their own
  branded splash screen without forking the library.
- **No "click to start" gate.** The runtime starts immediately on completion, preventing browsers
  (notably Chrome) from unlocking the `AudioContext` via the required user gesture.

**Goal:** Replace `Loading.ts` and its Lit dependency with a `SplashScene` that:

1. Renders entirely within the existing `WebGLRenderer` canvas using Three.js primitives and the
   engine's `UIRenderer` / `UISprite` / `UIText` system.
2. Adds a **click-to-start** gate after loading completes.
3. Exposes a clean, stable `SplashScreen` interface so developers can inject their own branded
   splash screen.
4. Removes `lit` from the runtime's production dependencies.

---

## 2. Constraints & Non-Goals

| Constraint | Reasoning |
|---|---|
| `UIText` may use `CSS2DObject` internally | Accepted — the user explicitly allowed this. |
| Logo as a `THREE.Texture` (PNG) | SVG loading via `TextureLoader` is unreliable; use a pre-rasterised PNG. |
| No 1-to-1 visual parity with the Lit design | Animations, shimmer, blur effects are not ported. A clean, simple visual is acceptable. |
| No changes to `@jolly-pixel/engine` sources | The UI system is consumed as-is; no new engine APIs are added. |
| `loadRuntime()` public signature stays compatible | `LoadRuntimeOptions` gains an optional field; no breaking change. |

---

## 3. Current Architecture (summary)

```
loadRuntime(runtime, options)
  │
  ├─ getGPUTier() (kicks off async)
  ├─ runtime.canvas.style.opacity = "0"   ← hides the WebGL canvas
  ├─ <jolly-loading> created and appended to document.body  ← Lit web component
  ├─ runtime.manager.onProgress → loadingComponent.setProgress()
  │
  ├─ await loadingDelay (850 ms)
  ├─ await gpuTierPromise
  ├─ await Systems.Assets.loadAssets(...)
  │     onStart → loadingComponent.setAsset()
  │
  ├─ await loadingComponent.complete()    ← CSS fade-out, remove from DOM
  ├─ runtime.canvas.style.opacity = "1"  ← reveals WebGL canvas
  └─ runtime.start()                     ← starts the animation loop
```

Key issue: `runtime.start()` (and therefore `world.connect()` + the `setAnimationLoop`) is called
**at the very end**, so there is no engine lifecycle available during loading.

---

## 4. Proposed Architecture

### 4.1. Central idea: start the loop early

`Runtime.start()` calls `world.connect()` then `renderer.setAnimationLoop(...)`. Its `#isRunning`
guard makes it idempotent — a second call is a no-op. The refactored `loadRuntime()` calls
`runtime.start()` **at the beginning**, so the engine's actor lifecycle is available for the
splash scene. When `loadRuntime()` resolves the loop is already running; no change is needed in
user code.

Because the splash scene fills the entire canvas, the canvas no longer needs to be hidden via
`style.opacity = "0"`. That workaround is removed.

### 4.2. High-level flow

```
loadRuntime(runtime, options)
  │
  ├─ getGPUTier() (kicks off async)
  │
  ├─ splashScreen = options.splashScreen ?? new DefaultSplashScreen()
  ├─ world.sceneManager.appendScene(splashScreen.scene)   ← overlay on top of any existing scene
  ├─ runtime.start()                                      ← world.connect() + animation loop START
  │     First frame: SplashScene actors awake, UIRenderer mounts CSS2DRenderer
  │
  ├─ await timers.setTimeout(loadingDelay)  (≥ 1 frame for awake/start to have run)
  ├─ await gpuTierPromise
  │     → splashScreen.onProgress() / splashScreen.onError()
  │
  ├─ await Systems.Assets.loadAssets(...)
  │     onStart → splashScreen.onAssetStart()
  │     runtime.manager.onProgress → splashScreen.onProgress()
  │
  ├─ splashScreen.onLoadComplete()   ← shows "Click to start"
  ├─ await splashScreen.waitForUserGesture()   ← resolves on first pointer-down
  │
  ├─ await splashScreen.complete()   ← fade-out, scene removed from SceneManager
  └─ (runtime loop continues with game scene)
```

### 4.3. `SplashScreen` interface

Defined in `packages/runtime/src/splash/SplashScreen.ts`.

```ts
export interface SplashScreen {
  /**
   * The Scene instance that the splash screen manages.
   * loadRuntime() appends this to the SceneManager as an overlay.
   */
  readonly scene: Systems.Scene<any>;

  /**
   * Called once after the Scene has been appended and runtime.start() has been
   * called. Use this to perform any setup that requires the world to be connected
   * (e.g. resolving world bounds, loading textures via LoadingManager).
   */
  onSetup(world: Systems.World<THREE.WebGLRenderer, any>): void;

  /** Update the loading bar. */
  onProgress(loaded: number, total: number): void;

  /** Update the current-asset label. */
  onAssetStart(asset: Systems.Asset): void;

  /** Switch to the error state. */
  onError(error: Error): void;

  /**
   * Called when all assets are loaded. The implementation should now display
   * a "click / tap to start" prompt and resolve waitForUserGesture().
   */
  onLoadComplete(): void;

  /**
   * Returns a Promise that resolves after the user has produced a pointer-down
   * or keydown event (i.e. the required user gesture for AudioContext unlock).
   */
  waitForUserGesture(): Promise<void>;

  /**
   * Trigger the outro animation and remove the scene.
   * Resolves when the transition is fully complete.
   */
  complete(): Promise<void>;
}
```

### 4.4. `DefaultSplashScreen`

New file: `packages/runtime/src/splash/DefaultSplashScreen.ts`

Extends `Systems.Scene` and also implements `SplashScreen`.

#### Actor / component layout

```
World.SceneManager (overlay)
└── SplashScene  (DefaultSplashScreen extends Scene)
    │
    ├── Actor "UIRoot"
    │     └── UIRenderer                  ← one CSS2DRenderer, ortho camera
    │
    ├── Actor "Background"
    │     └── UISprite  size=screenSize   color=#1a1a2e   anchor=center/center
    │
    ├── Actor "Logo"
    │     └── UISprite  size=320x120      map=logoTexture  anchor=center/center  offset.y=+60
    │
    ├── Actor "ProgressTrack"
    │     └── UISprite  size=400x8        color=#333344   anchor=center/center  offset.y=-30
    │
    ├── Actor "ProgressFill"
    │     └── UISprite  size=400x8        color=#4a8fd8   anchor=center/center  offset.y=-30
    │           pivot.x=0 (left-anchored)
    │           mesh.scale.x is set to progress [0..1] each frame
    │
    ├── Actor "AssetLabel"
    │     └── UISprite (invisible, 400x20, anchor=center, offset.y=-48)
    │           └── UIText  "Loading runtime…"  fontSize=11px color=#aaaacc
    │
    ├── Actor "ClickPrompt"   (hidden until onLoadComplete())
    │     └── UISprite (invisible, 400x30, anchor=center/center, offset.y=-60)
    │           └── UIText  "Click anywhere to start"  fontSize=16px color=#ffffff
    │
    └── Actor "ErrorPanel"   (hidden until onError())
          └── UISprite (invisible, 500x200, color=#1c0a00, anchor=center/center)
                ├── UIText (message)   color=#ef5350  fontSize=13px
                └── UIText (stack)     color=#90a4ae  fontSize=10px
```

> **Logo texture:** `THREE.TextureLoader` with `transparent: true`.
> The existing `jollypixel-full-logo-min.svg` should be exported to
> `jollypixel-full-logo.png` (≥ 480×140 px) and placed alongside the current SVG.
> The path is resolved relative to the HTML page, same as today.

#### Progress bar scaling trick

`ProgressFill` uses `UINode` with `pivot = { x: 0, y: 0.5 }` and `anchor = { x: "left" }`.
Its `UISprite.mesh` is a `PlaneGeometry(1, 8)` with `mesh.scale.x = progress * 400`.
This avoids rebuilding geometry and does not require a canvas texture.

The `UINode` offset is set so that the left edge of the fill aligns with the left edge of the track.

#### Visibility control

Rather than removing actors, visibility is toggled via:
- `UISprite.mesh.visible = false/true`
- `UIText` element `style.display = "none"/"block"`

State transitions are therefore frame-instant (no awaits inside state changes).

#### State machine

```
         ┌──────────────┐
         │   LOADING     │  (initial state)
         │ progress bar  │
         │ asset label   │
         └──────┬────────┘
                │ all assets loaded (onLoadComplete)
                ▼
         ┌──────────────┐
         │  READY        │
         │ progress=100% │
         │ click prompt  │
         └──────┬────────┘
                │ pointer-down or keydown anywhere
                ▼
         ┌──────────────┐
         │  FADING OUT   │
         │ alpha 1→0     │
         │ over 600 ms   │
         └──────┬────────┘
                │
                ▼
            COMPLETE  (scene removed, complete() resolves)

LOADING or READY → ERROR (on any onError() call)
         ┌──────────────┐
         │   ERROR       │
         │ error panel   │
         │ (no exit)     │
         └──────────────┘
```

#### Fade-out technique

There is no `THREE.Scene.fog`-based fade. Instead, the `Background` UISprite's `MeshBasicMaterial`
alpha is animated from 1 to 0 over 600 ms using the scene's `update(deltaTime)` method, driving a
`#fadeAlpha` accumulator. All other sprites share the same `MeshBasicMaterial` alpha.

Because `UIText` is a `CSS2DObject` (a DOM element), its opacity is driven via `element.style.opacity`.

#### `waitForUserGesture()` implementation

```ts
waitForUserGesture(): Promise<void> {
  return new Promise((resolve) => {
    // UISprite signals are only available after awake; background sprite receives all clicks
    this.#backgroundSprite.onClick.once(() => resolve());
    // Keyboard fallback
    this.#keydownHandler = () => resolve();
    window.addEventListener("keydown", this.#keydownHandler, { once: true });
  });
}
```

The "Click anywhere" prompt is attached to the `Background` sprite (full-screen), so any click
resolves the promise.

### 4.5. `loadRuntime()` refactor

```
packages/runtime/src/index.ts  (modified)
```

Key changes vs today:

| Area | Old | New |
|---|---|---|
| Canvas hidden | `canvas.style.opacity = "0"` immediately | Removed entirely |
| Loading UI | `document.createElement("jolly-loading")` | `new DefaultSplashScreen()` (or custom) |
| Loop start | At the very end, after `complete()` | **At the beginning**, after appendScene |
| Click gate | None | `await splashScreen.waitForUserGesture()` |
| Error display | `loadingComponent.error(error)` | `splashScreen.onError(error)` |
| Canvas reveal | `canvas.style.opacity = "1"` | Removed (canvas always visible) |
| Runtime.start() | Called once at end | Called once at start; idempotent guard prevents double-call |

Simplified pseudo-code:

```ts
export async function loadRuntime(
  runtime: Runtime<any>,
  options: LoadRuntimeOptions = {}
) {
  const { loadingDelay = 850, splashScreen: splashFactory } = options;

  const gpuTierPromise = getGPUTier();
  const splash: SplashScreen = splashFactory
    ? (typeof splashFactory === "function" ? splashFactory() : splashFactory)
    : new DefaultSplashScreen();

  runtime.world.sceneManager.appendScene(splash.scene);
  runtime.start();
  // world.connect() + setAnimationLoop() called here;
  // first frame will awake/start all SplashScene actors.

  splash.onSetup(runtime.world);

  // Prevent keypress events from leaking to a parent window
  runtime.canvas.addEventListener("keypress", (event) => event.preventDefault());
  // Focus canvas on any document click (separate from click-to-start)
  document.addEventListener("click", () => runtime.canvas.focus());

  let loadingComplete = false;
  const loadingCompletePromise = new Promise<void>((resolve) => {
    runtime.manager.onProgress = (_, loaded, total) => {
      splash.onProgress(loaded, total);
      if (loaded >= total && !loadingComplete) {
        loadingComplete = true;
        setTimeout(() => resolve(), 100);
      }
    };
  });

  try {
    if (loadingDelay > 0) {
      await timers.setTimeout(loadingDelay);
    }

    const { fps, isMobile = false, tier } = await gpuTierPromise;
    runtime.world.setFps(fps ?? 60);
    runtime.world.renderer.getSource().setPixelRatio(getDevicePixelRatio(isMobile));
    if (tier < 1) {
      throw new Error("GPU is not powerful enough to run this game");
    }

    const context = { manager: runtime.manager };
    setTimeout(() => {
      Systems.Assets.autoload = true;
      Systems.Assets.scheduleAutoload(context);
    });

    if (Systems.Assets.waiting.size > 0) {
      await Systems.Assets.loadAssets(context, {
        onStart: (asset) => splash.onAssetStart(asset)
      });

      if (loadingComplete) {
        await loadingCompletePromise;
      }
      else {
        splash.onProgress(1, 1);
        await timers.setTimeout(100);
      }
    }

    splash.onLoadComplete();
    await splash.waitForUserGesture();
    await splash.complete();
  }
  catch (error: any) {
    splash.onError(error);
    // Loop keeps running; splash stays visible with error panel.
    // loadRuntime() does NOT resolve on error — game never starts.
  }
}
```

### 4.6. `LoadRuntimeOptions` extension

```ts
export interface LoadRuntimeOptions {
  /** @default 850 */
  loadingDelay?: number;

  /**
   * Custom splash screen to use instead of the built-in DefaultSplashScreen.
   * Pass either an SplashScreen instance or a factory function.
   *
   * @example
   * // Instance
   * await loadRuntime(runtime, { splashScreen: new MyBrandedSplash() });
   *
   * // Factory (created lazily, after Runtime is constructed)
   * await loadRuntime(runtime, { splashScreen: () => new MyBrandedSplash() });
   */
  splashScreen?: SplashScreen | (() => SplashScreen);
}
```

---

## 5. File Changes

### New files

```
packages/runtime/src/splash/
  SplashScreen.ts          ← interface (exported from public barrel)
  DefaultSplashScreen.ts    ← extends Scene<any>, implements SplashScreen
```

```
packages/runtime/public/images/
  jollypixel-full-logo.png  ← PNG export of the existing SVG (≥ 480×140 px, transparent bg)
```

### Modified files

```
packages/runtime/src/index.ts          ← loadRuntime() refactored, SplashScreen re-exported
packages/runtime/package.json          ← remove "lit" dependency
packages/runtime/src/exports.ts        ← (if barrel exists) add SplashScreen export
```

### Deleted files

```
packages/runtime/src/components/Loading.ts   ← Lit web component, fully replaced
```

---

## 6. Implementation Steps (ordered)

### Step 1 — Export PNG logo

Export `jollypixel-full-logo-min.svg` to `jollypixel-full-logo.png` at 480×140 px with
transparent background. Place it in `packages/runtime/public/images/`.

### Step 2 — Define `SplashScreen`

Create `packages/runtime/src/splash/SplashScreen.ts` with the interface described in §4.3.
Export it from the runtime's public barrel.

### Step 3 — Implement `DefaultSplashScreen`

Create `packages/runtime/src/splash/DefaultSplashScreen.ts`:

1. Extend `Systems.Scene<any>`.
2. In `awake()`:
   - Create the "UIRoot" actor; add `UIRenderer` component.
   - Create "Background", "Logo", "ProgressTrack", "ProgressFill", "AssetLabel",
     "ClickPrompt", "ErrorPanel" actors with their `UISprite` / `UIText` components.
   - Store references to all components that need runtime updates.
3. Implement `update(dt)`:
   - If state is `FADING_OUT`, increment `#fadeAlpha` accumulator and apply opacity to
     all sprites and UIText elements. When alpha reaches 0, set state `COMPLETE` and
     resolve `#completeResolve`.
4. Implement all `SplashScreen` methods (onProgress, onAssetStart, onError, etc.).
5. `complete()` sets state to `FADING_OUT` and returns `#completePromise`.
6. `waitForUserGesture()` as described in §4.4.
7. After `complete()` resolves, call
   `this.world.sceneManager.removeScene(this)` to clean up.

### Step 4 — Refactor `loadRuntime()`

Apply the changes described in §4.5:
- Remove canvas opacity manipulation.
- Remove Lit component creation/querying.
- Add splash screen wiring.
- Move `runtime.start()` to before the async work.
- Add `waitForUserGesture()` await between asset loading and `complete()`.
- Update `LoadRuntimeOptions` (§4.6).

### Step 5 — Remove Lit dependency

```bash
npm uninstall lit -w @jolly-pixel/runtime
```

Remove the `Loading` import from `index.ts`.
Delete `packages/runtime/src/components/Loading.ts`.

### Step 6 — Test

- Verify progress bar fills correctly when assets load.
- Verify error panel appears on GPU tier failure.
- Verify "Click to start" prompt appears after loading.
- Verify that clicking starts the game and `AudioContext` is unlocked.
- Verify that a custom `SplashScreen` can be injected and renders correctly.
- Verify `loadRuntime()` resolves correctly with no assets.

---

## 7. Customization Guide (future developers)

To create a custom splash screen:

```ts
import type { SplashScreen } from "@jolly-pixel/runtime";
import { Systems } from "@jolly-pixel/engine";

export class MyBrandedSplash extends Systems.Scene<any> implements SplashScreen {
  readonly scene = this;
  // ...implement SplashScreen methods
}

await loadRuntime(runtime, {
  splashScreen: new MyBrandedSplash()
});
```

The `DefaultSplashScreen` can also be subclassed to override only specific visual elements
(e.g. changing logo texture or progress bar colour) without reimplementing the whole state machine.

---

## 8. Trade-offs & Known Limitations

| Trade-off | Notes |
|---|---|
| `UIText` still uses a DOM element via `CSS2DObject` | Accepted per user instructions. This means text is not affected by WebGL post-processing. |
| Progress bar uses `mesh.scale.x` | Simple and performant but requires careful pivot/offset math on `ProgressFill` UINode. |
| `runtime.start()` is called early | The world's actor lifecycle starts during loading. Any scene the user has set up before calling `loadRuntime()` will also start ticking. For most use-cases this is fine (user sets scene after `loadRuntime()` resolves). Add a note to the docs. |
| No CSS shimmer/blur animation | The Lit design had a blue shimmer on the progress bar and a speed-blur class. These are not ported. Can be added later via a `ShimmerBehavior` or a canvas texture. |
| Logo must be a raster PNG | Three.js `TextureLoader` does not reliably parse SVG. A PNG must be generated at build time. |
| `complete()` may resolve before `SceneManager.removeScene` fully processes | `removeScene` queues destruction; actors are destroyed at end-of-frame. `complete()` resolves at the start of this sequence. The game scene begins rendering in the following frame. |

---

## 9. Open Questions

1. **`appendScene` vs `setScene`:** Using `appendScene` (overlay) means any scene the developer
   sets before `loadRuntime()` is also active during loading. `setScene` would replace it.
   `appendScene` is safer for the common pattern where the game scene is set after `loadRuntime()`
   resolves, but needs verification.

2. **`SceneManager.removeScene` API:** Verify that `removeScene(scene)` accepts a `Scene` instance
   (not just a name/id) and that it correctly disposes all actors and the `UIRenderer`'s
   `CSS2DRenderer` DOM element.

3. **`UIRenderer` + `appendScene`:** If the game also uses `UIRenderer` on its own actors, there
   will be two `CSS2DRenderer` DOM elements during the transition frame. Confirm this does not
   produce z-fighting or duplicate renders.

4. **Audio context unlock timing:** Browsers require the user gesture to happen within the same
   call stack as `AudioContext.resume()`. Confirm that the `onClick` signal from `UISprite`
   and the `once` keydown listener satisfy this requirement for the major browsers.
