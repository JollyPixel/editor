# Scene gizmos

Markers an editor draws for objects that render nothing on their own: `CameraGizmo` for a camera and `LightGizmo` for a light. Each one shows a flat icon that keeps the same size on screen whatever the distance, and is drawn over the scene. Add them to the scene root and call `update()` every frame.

```ts
import { CameraGizmo, LightGizmo } from "@jolly-pixel/three";

const cameraGizmo = new CameraGizmo();
const lightGizmo = new LightGizmo();
scene.add(cameraGizmo, lightGizmo);

cameraGizmo.update({
  projection: "perspective",
  fov: 50,
  near: 0.1,
  far: 1000,
  orthographicScale: 10
}, cameraActor.matrixWorld);
lightGizmo.update(sun);

lightGizmo.selected = true;
```

## CameraGizmo

```ts
interface CameraGizmoOptions {
  color?: THREE.ColorRepresentation; // "#aab4c3"
  selectedColor?: THREE.ColorRepresentation; // "#f5c46b"
  aspect?: number; // 16 / 9
  depth?: number; // 3, longest drawn distance past near
}

interface CameraGizmoLens {
  projection: "perspective" | "orthographic";
  fov: number; // degrees
  near: number;
  far: number;
  orthographicScale: number; // view height in world units
}
```

### update(lens, matrixWorld): void

Draws a camera icon and the frustum of `lens`, cut at `near + depth`. A perspective frustum has lines from the camera to its near rectangle; an orthographic one is a box `orthographicScale` tall. A triangle above the far rectangle marks the camera's up side. The gizmo takes the position and rotation of `matrixWorld` and ignores its scale.

### selected: boolean

Draws the frustum and icon in `selectedColor` instead of `color` and white.

### dispose(): void

## LightGizmo

```ts
interface LightGizmoOptions {
  selectedColor?: THREE.ColorRepresentation; // "#f5c46b"
}
```

### update(light): void

Moves to the light's world position, turns toward its target, and draws the icon of its type, tinted with the light's color: a sun for a directional light, a spotlight, a sky over the ground for a hemisphere light, a bulb for a point light, and a dotted ring for any other light.

### selected: boolean

Tints the icon with `selectedColor` and shows the light's shape:

- directional: an arrow along the light direction;
- spot: its cone, `distance` long, or 2 units when `distance` is 0;
- point: three circles at `distance`, none when `distance` is 0.

Hemisphere and ambient lights have no shape.

### dispose(): void
