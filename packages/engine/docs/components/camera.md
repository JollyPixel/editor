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

The actor's transform is the single source of truth for the camera
pose. Every frame, `prepareRender` copies `actor.object3D.matrixWorld`
onto the camera and mirrors it into `camera.position` /
`camera.quaternion`.

Writing to the `THREE.Camera` directly does **not** work — those
writes are overwritten on the next frame:

```ts
// ❌ silently reverted every frame
component.threeCamera.position.set(10, 10, 5);

// ✅
component.actor.transform
  .setLocalPosition({ x: 10, y: 10, z: 5 })
  .lookAt({ x: 0, y: 0, z: 0 });
```

Because the actor owns the pose, parenting works as expected —
attach the camera actor to another actor and it follows.

Mechanically, the component sets `matrixWorldAutoUpdate = false` on
its `THREE.Camera`. Without it, three recomposes `matrixWorld` from
the camera's own local transform right before drawing
(`WebGPURenderer` does this for any camera whose `parent` is `null`),
throwing away what `prepareRender` wrote. As a consequence three
never walks the camera's children either, so the component updates
them itself — that is what keeps an attached `AudioListener`
positioned correctly.

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
}
```

| Option | Default | Description |
| ------ | ------- | ----------- |
| `projectionMode` | `"perspective"` | |
| `fov` | `45` | Vertical field of view, degrees |
| `near` | `0.1` | Near clipping plane |
| `far` | `10000` | Far clipping plane |
| `orthographicScale` | `1` | Ortho half-height in world units |
| `viewport` | `null` | Normalized rect; `null` is the full canvas |
| `depth` | `0` | Render order — lower first |
| `addAudioListener` | `false` | Attaches the world's `THREE.AudioListener` |

> [!NOTE]
> The default `near`/`far` pair is a 100,000:1 ratio, which leaves
> roughly 0.6 world units of depth resolution at 1000 units out on a
> 24-bit depth buffer. For large worlds, raise `near` as far as the
> scene allows, or enable `logarithmicDepthBuffer` through the
> [renderer's `webgl` options](../systems/renderer.md#configuration).

## Viewport and depth

`depth` orders cameras within a frame: lower renders first
(background), higher last (overlay). `viewport` restricts a camera to
a normalized rect of the canvas — `{ x: 0, y: 0, width: 0.5, height: 1 }`
is the left half, with `y = 0` at the bottom per the WebGL convention.

```ts
// Split screen
world.createActor("p1").addComponent(CameraComponent, {
  viewport: { x: 0, y: 0, width: 0.5, height: 1 }
});
world.createActor("p2").addComponent(CameraComponent, {
  viewport: { x: 0.5, y: 0, width: 0.5, height: 1 }
});
```

Viewports only apply in the renderer's `"direct"` mode — see the
[render modes](../systems/renderer.md#render-modes) warning.

## Runtime changes

Every setter marks the projection dirty; it is recomputed before the
next draw.

```ts
camera
  .setFov(75)
  .setNearFar(0.5, 5000)
  .setOrthographicScale(10)
  .setViewport(null)
  .setDepth(10);
```

`setProjectionMode` swaps the underlying `THREE.Camera` for a new one
of the other kind. It carries the attached objects (the audio
listener) and the layer mask across, and tells the renderer to rebind
anything keyed on the old camera:

```ts
camera.setProjectionMode("orthographic");
```

## See also

- [Camera3DControls](camera-3d-controls.md) — first-person controller
- [Renderer](../systems/renderer.md) — how cameras are drawn
