# Scene gizmos

Wireframe markers an editor draws for objects that render nothing on their own: `CameraGizmo` for a camera and `LightGizmo` for a light. Add them to the scene root and call `update()` every frame.

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
```

## CameraGizmo

```ts
interface CameraGizmoOptions {
  color?: THREE.ColorRepresentation; // "#f5c46b", the body
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

Draws a box body and the `THREE.CameraHelper` frustum of `lens`, cut at `near + depth`, and places itself with `matrixWorld`. A projection change replaces the frustum and disposes the old one.

### dispose(): void

## LightGizmo

```ts
interface LightGizmoOptions {
  color?: THREE.ColorRepresentation; // "#f5c46b"
}
```

### update(light): void

Draws an octahedron icon at the light's world position and the three.js helper of the light's type: directional, spot, hemisphere or point. An ambient light gets the icon only. Passing another light replaces the helper and disposes the old one.

### dispose(): void
