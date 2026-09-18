# createViewHelper

Draws a Three.js `ViewHelper` (an axis gizmo in a corner of the canvas)
for a camera after every rendered frame.

```ts
import { createViewHelper } from "@jolly-pixel/engine";

const binding = createViewHelper(camera.threeCamera, world);

// Later, when the camera goes away
binding.dispose();
```

## API

```ts
interface ViewHelperBinding {
  helper: ViewHelper;
  /** Stops drawing and releases the helper. */
  dispose(): void;
}

function createViewHelper(
  camera: THREE.Camera,
  world: World
): ViewHelperBinding;
```

The helper renders from the renderer `draw` event. Call `dispose()`
before dropping the camera, otherwise the listener keeps the helper
alive and keeps drawing it.

[OrbitFlyCamera](../components/orbit-fly-camera.md) creates one by
default and disposes it on destroy.
