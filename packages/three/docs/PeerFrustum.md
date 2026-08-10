# PeerFrustum

`PeerFrustum` is a static wireframe camera shape for showing another user's position and orientation. It extends `THREE.LineSegments` and can include a canvas-rendered name label.

```ts
import { PeerFrustum } from "@jolly-pixel/three";

const frustum = new PeerFrustum({
  color: "#43aa8b",
  name: "Alice"
});

frustum.position.copy(peerCamera.position);
frustum.quaternion.copy(peerCamera.quaternion);
scene.add(frustum);
```

Copy the represented camera's quaternion when possible. The wireframe points along local `-Z`, while `Object3D.lookAt()` points a regular object's local `+Z` at its target.

## Constructor

```ts
new PeerFrustum(options?: PeerFrustumOptions)
```

The constructor creates near and far wireframe rectangles with four connecting edges. `showApex` adds four lines from the local origin to the near rectangle.

```ts
interface PeerFrustumOptions {
  fov?: number;
  aspect?: number;
  near?: number;
  depth?: number;
  color?: THREE.ColorRepresentation;
  showApex?: boolean;
  name?: string;
  showNameBox?: boolean;
}
```

| Option | Default | Description |
|---|---:|---|
| `fov` | `50` | Vertical field of view in degrees. |
| `aspect` | `16 / 9` | Width-to-height ratio. |
| `near` | `depth * 0.2` | Distance from the local origin to the near rectangle. |
| `depth` | `1.5` | Distance from the local origin to the far rectangle. |
| `color` | `"#43aa8b"` | Wireframe and label accent color. |
| `showApex` | `false` | Adds lines between the origin and near rectangle. |
| `name` | none | Creates a floating label when provided. |
| `showNameBox` | `false` | Draws the label on a bordered background. |

`near` must be greater than `0` and less than `depth`; invalid values throw. The geometry settings `fov`, `aspect`, `near`, `depth`, and `showApex` are constructor-only. Create a replacement frustum to change them.

## Properties

### `label`

```ts
label: PeerFrustumLabel | null
```

The label is `null` until a name is passed to the constructor or `setName()`. Once created, it is added as a child of the frustum. Use the methods on `PeerFrustum` to keep label color and box state synchronized with the wireframe.

Inherited `Object3D` properties such as `position`, `quaternion`, `scale`, and `visible` remain available.

## Methods

### `setColor()`

```ts
setColor(color: THREE.ColorRepresentation): void
```

Changes the wireframe color and redraws an existing label. The value is also retained for a label created later by `setName()`.

### `setName()`

```ts
setName(name: string): void
```

Creates the label when needed, or redraws the existing label with the new name. Calling this method requires a DOM with canvas support.

### `setShowNameBox()`

```ts
setShowNameBox(showNameBox: boolean): void
```

Changes the background style of an existing label. When no label exists, the setting is retained and applied by the next `setName()` call.

### `dispose()`

```ts
dispose(): void
```

Disposes the wireframe geometry and material, then disposes the label texture and material when present. It does not remove the frustum from its parent.

```ts
scene.remove(frustum);
frustum.dispose();
```

## PeerFrustumLabel

`PeerFrustumLabel` is the exported sprite used by `PeerFrustum`. Most consumers can manage it through the owning frustum, but it can also be constructed directly.

```ts
interface PeerFrustumLabelOptions {
  name: string;
  color: THREE.ColorRepresentation;
  showNameBox?: boolean;
}

new PeerFrustumLabel(options: PeerFrustumLabelOptions)
```

Construction requires `document.createElement("canvas")` and a 2D canvas context. A nameless `PeerFrustum` does not create a label and does not access the DOM.

The label uses a transparent `THREE.SpriteMaterial` with `depthTest: false` and `depthWrite: false`. It stays visible through scene geometry. Sprite size attenuation remains enabled, so its on-screen size decreases with distance.

### Label methods

```ts
setName(name: string): void
setColor(color: THREE.ColorRepresentation): void
setShowNameBox(showNameBox: boolean): void
dispose(): void
```

The three setters redraw the canvas texture immediately. `dispose()` releases the texture and sprite material.
