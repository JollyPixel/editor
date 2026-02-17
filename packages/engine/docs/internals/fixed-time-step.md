# FixedTimeStep

`FixedTimeStep` decouples the game's **logical update rate** (e.g. physics, simulation) from the display's frame rate. Instead of updating once per rendered frame (which varies with hardware and browser load), it accumulates elapsed time and runs a fixed number of updates at a constant interval. This ensures deterministic, reproducible physics and gameplay regardless of rendering performance.

The implementation guards against the ["doom spiral"](http://blogs.msdn.com/b/shawnhar/archive/2011/03/25/technical-term-that-should-exist-quot-black-pit-of-despair-quot.aspx) — a situation where each tick takes longer than the previous one — by capping accumulated time to at most 5 update intervals.

## Usage

```ts
import { FixedTimeStep } from "@jolly-pixel/engine";

const fixedTimeStep = new FixedTimeStep();
fixedTimeStep.setFps(60); // (render FPS, fixed update FPS)

// Start the timer before your main loop
fixedTimeStep.start();

function loop() {
  fixedTimeStep.tick({
    fixedUpdate: (fixedDelta) => {
      // Run physics or deterministic logic here
      game.fixedUpdate(fixedDelta);
    },
    update: (interpolation, delta) => {
      // Use interpolation for smooth rendering
      game.render(interpolation, delta);
    }
  });

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
```

deterministic time):

## Callbacks

`FixedTimeStep` uses a callback object:

```ts
interface FixedTimeStepCallbacks {
  fixedUpdate: (fixedDelta: number) => void;
  update?: (interpolation: number, delta: number) => void;
}
```

- `fixedUpdate` is called one or more times per frame, using a fixed timestep (in ms). Use this for physics and deterministic logic.
- `update` is called once per frame

### Interpolation

The `interpolation` value passed to `update` allows you to render objects smoothly between physics steps. For example, if your physics runs at 60Hz but your display is 144Hz, you can interpolate between the previous and current physics states:

```ts
const renderedPosition = (1 - interpolation) * previousPosition + interpolation * currentPosition;
```

This makes movement appear smooth, even if the physics steps are less frequent than the rendering frames.

## Configuring the frame rate

The target frame rate defaults to **60 FPS** for both rendering and fixed updates. You can change them with `setFps(renderFps, fixedFps)`. Values are clamped between `1` and `FixedTimeStep.MaxFramesPerSecond` (60):

```ts
fixedTimeStep.setFps(30, 60); // 30 FPS render, 60 FPS fixed update
```

The fixed update interval is derived as `1000 / fixedFramesPerSecond` (in milliseconds).

## Doom spiral protection

If the browser stalls (e.g. tab switch, debugger breakpoint), the accumulated time can grow very large. Without a cap, the engine would try to catch up with dozens of updates in a single frame, making the problem worse.

`FixedTimeStep` limits catch-up to at most **5 intervals**, discarding excess time.
