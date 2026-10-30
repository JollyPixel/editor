# Camera

`CameraComponent` turns an actor into a camera. It owns a
`THREE.PerspectiveCamera` or `THREE.OrthographicCamera`, registers
itself with the [Renderer](../systems/renderer.md) on `awake()`, and
updates its projection whenever the canvas or its settings change.

```ts
world.createActor("camera")
  .addComponent(CameraComponent, {
    fov: 60,
    near: 0.5,
    far: 2000
  });
```

## The actor drives the camera

The camera copies the actor's world matrix before every draw, so writes to
the `THREE.Camera` are overwritten on the next frame:

```ts
// ❌ silently reverted every frame
component.threeCamera.position.set(10, 10, 5);

// ✅
component.actor.transform
  .setLocalPosition({ x: 10, y: 10, z: 5 })
  .lookAt({ x: 0, y: 0, z: 0 });
```

A camera actor parented to another actor follows it.

## Options

```ts
interface CameraOptions {
  projectionMode?: "perspective" | "orthographic";
  fov?: number;
  near?: number;
  far?: number;
  orthographicScale?: number;
  viewport?: RenderViewport | null;
  depth?: number;
  addAudioListener?: boolean;
  postProcessing?: PostProcessing | null;
  render?: boolean;
}
```

| Option | Default | Description |
| ------ | ------- | ----------- |
| `projectionMode` | `"perspective"` | |
| `fov` | `45` | Vertical field of view, degrees |
| `near` | `0.1` | Near clipping plane |
| `far` | `10000` | Far clipping plane |
| `orthographicScale` | `1` | Ortho half-height in world units |
| `viewport` | `null` | Normalized rect, each value clamped to `[0, 1]`; `null` is the full canvas |
| `depth` | `0` | Render order — lower first |
| `addAudioListener` | `false` | Attaches the world's `THREE.AudioListener` |
| `postProcessing` | `null` | Builds the camera's output node; see [post-processing](#post-processing) |
| `render` | `true` | Registers the camera with the renderer; `false` keeps the settings without drawing |

`CAMERA_DEFAULTS` holds these defaults.

> [!NOTE]
> The default `near`/`far` ratio is 100,000:1, which leaves little depth
> precision far out. For large worlds, raise `near`, or enable
> `logarithmicDepthBuffer` through the
> [renderer's `webgpu` options](../systems/renderer.md#configuration).

## Viewport and depth

`depth` orders cameras within a frame: lower renders first. `viewport`
restricts a camera to a normalized rect of the canvas, with `y = 0` at the
bottom.

```ts
// Split screen
world.createActor("p1").addComponent(CameraComponent, {
  viewport: { x: 0, y: 0, width: 0.5, height: 1 }
});
world.createActor("p2").addComponent(CameraComponent, {
  viewport: { x: 0.5, y: 0, width: 0.5, height: 1 }
});
```

## Post-processing

`postProcessing` returns the output node of a `THREE.RenderPipeline`
that replaces the camera's direct render. See
[post-processing](../systems/renderer.md#post-processing).

```ts
import { pass } from "three/tsl";

camera.postProcessing = ({ scene, camera }) => {
  return pass(scene, camera);
};

// Back to a direct render
camera.postProcessing = null;
```

## Runtime changes

`configure(settings)` takes any of `projectionMode`, `fov`, `near`, `far`,
`orthographicScale`, `viewport` and `depth`, and keeps the ones it is not
given. The projection matrix is rewritten at once; the render order applies
on the next draw. `settings` returns the current values, with `viewport` as
a `Viewport`.

```ts
camera.configure({
  fov: 75,
  near: 0.5,
  far: 5000,
  viewport: null,
  depth: 10
});
```

A new `projectionMode` replaces `threeCamera` with one of the other kind,
keeping its attached objects and layer mask:

```ts
camera.configure({ projectionMode: "orthographic" });
```

`projection` is the `CameraProjection` behind `threeCamera`: a
`PerspectiveProjection` or an `OrthographicProjection`.
`projection.requirePerspective()` returns the `THREE.PerspectiveCamera`
and throws for an orthographic projection.

## See also

- [Camera3DControls](camera-3d-controls.md) — first-person controller
- [OrbitFlyCamera](orbit-fly-camera.md) — fly camera with an optional orbit/elastic pivot
- [Renderer](../systems/renderer.md) — how cameras are drawn
