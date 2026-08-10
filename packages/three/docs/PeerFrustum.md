# PeerFrustum

Lightweight camera-frustum representation for a connected peer, extending
`THREE.LineSegments`. Deliberately not a `THREE.CameraHelper`: that requires a
real `THREE.Camera` per peer and draws extra guide lines (target cross) not
wanted for a presence indicator. `PeerFrustum` builds a static wireframe
truncated pyramid once from a fixed FOV/aspect/near/depth — near and far
planes are drawn as wireframe rectangles, not filled planes, connected by a
body, with an optional apex tip; position/orient it via the usual `Object3D`
transform, so N peers stay cheap — no per-peer projection-matrix work.

```ts
import { PeerFrustum } from "@jolly-pixel/three";

const frustum = new PeerFrustum({ color: "#43aa8b", name: "Alice" });
frustum.position.copy(position);
frustum.lookAt(lookAt);
scene.add(frustum);
```

## PeerFrustumOptions

```ts
export interface PeerFrustumOptions {
  /**
   * Vertical field of view in degrees, used only to shape the visualized frustum
   * (not tied to the represented peer's actual camera near/far planes).
   * @default 50
   */
  fov?: number;
  /**
   * @default 16 / 9
   */
  aspect?: number;
  /**
   * Near-plane visualization distance (apex-to-near-plane), in world units.
   * Purely cosmetic — drawn as a wireframe rectangle, not a filled plane.
   * Must be strictly between 0 and `depth`.
   * @default depth * 0.2
   */
  near?: number;
  /**
   * Visualization depth (apex-to-far-plane distance), in world units. Purely
   * controls how large the frustum reads on screen.
   * @default 1.5
   */
  depth?: number;
  /**
   * @default "#43aa8b"
   */
  color?: THREE.ColorRepresentation;
  /**
   * Whether to draw the tip lines from the apex (the peer's position) down to
   * the near plane. Enable for an at-a-glance sense of exactly where the peer
   * is — the near/far rectangles and the edges connecting them are always
   * drawn regardless.
   * @default false
   */
  showApex?: boolean;
  /**
   * Display name for the connected peer, rendered as a floating nameplate
   * above the frustum. Omit to render the frustum without one.
   */
  name?: string;
  /**
   * Draws the nameplate on a rounded, semi-transparent background box
   * (bordered with `color`) instead of the default shadow-only text.
   * @default false
   */
  showNameBox?: boolean;
}
```

## Properties

```ts
class PeerFrustum extends THREE.LineSegments {
  // null until a name is provided (constructor `name` option or `setName`)
  label: PeerFrustumLabel | null;
}

class PeerFrustumLabel extends THREE.Sprite {
  setName(name: string): void;
  setColor(color: THREE.ColorRepresentation): void;
  setShowNameBox(showNameBox: boolean): void;
  dispose(): void;
}
```

`PeerFrustumLabel` is the nameplate itself — a billboard `THREE.Sprite` with a canvas-generated texture, added as a child of `PeerFrustum` once a name exists. It's constructed and updated by `PeerFrustum` (see Methods below); reach into `frustum.label` directly only if you need the sprite itself (e.g. to read its current world transform).

## Methods

- `setColor(color: THREE.ColorRepresentation): void` - Updates the wireframe's material color, and forwards to `label.setColor()` if a label exists.
- `setName(name: string): void` - Forwards to `label.setName()`, creating `label` lazily (and adding it as a child) if the frustum was built without one.
- `setShowNameBox(showNameBox: boolean): void` - Forwards to `label.setShowNameBox()` if a label exists.
- `dispose(): void` - Disposes the underlying geometry, material, and `label` (if any).

## Notes

- By default (`showNameBox: false`) the nameplate is bold text colored to match the frustum with a dark drop shadow, no background — reads against any scene background without visual clutter. Set `showNameBox: true` for a rounded, semi-transparent box bordered in `color` instead, with white text. Rendered with `depthTest: false` so it stays legible through other geometry — no extra renderer setup (e.g. `CSS2DRenderer`) required. Like any `THREE.Sprite`, its on-screen size shrinks with camera distance (`sizeAttenuation` defaults to `true`) — let us know if you'd rather it stay a constant screen size regardless of distance.
- Constructing with an invalid `near` (`<= 0` or `>= depth`) throws.
