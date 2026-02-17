## Transform

Wrapper around a `THREE.Object3D` that exposes a clean API for reading and
writing an actor's position, orientation, and scale in both local and global
space. Every `Actor` owns a `Transform` accessible via `actor.transform`.

All setters and mutating methods return `this` for chaining.
Getters accept an optional output object; when omitted a new instance is returned.

```ts
import * as THREE from "three";
import { Actor } from "@jolly-pixel/engine";

const actor = new Actor(world, "Player");

// Read global position (no pre-allocation needed)
const pos = actor.transform.getGlobalPosition();
console.log(pos.x, pos.y, pos.z);

// Or reuse an existing object
const reusable = new THREE.Vector3();
actor.transform.getGlobalPosition(reusable);

// Chain setters
actor.transform
  .setLocalPosition({ x: 0, y: 1, z: 0 })
  .setVisible(true);

// Move the actor 5 units forward
actor.transform.moveForward(5);

// Rotate 45° around the Y axis (global)
const rotation = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, 1, 0),
  Math.PI / 4
);
actor.transform.rotateGlobal(rotation);

// Make the actor look at a target
actor.transform.lookAt(new THREE.Vector3(10, 0, 10));

// Interpolate toward a target
actor.transform
  .lerpPosition({ x: 10, y: 0, z: 5 }, 0.1)
  .slerpOrientation(targetQuat, 0.1);
```

### TransformLike

Several methods accept a `TransformLike` instead of requiring a raw
`Transform`. This type is defined as:

```ts
type TransformLike = Transform | { transform: Transform };
```

Any object with a `.transform` property (such as `Actor`) satisfies
this type, so you can pass actors directly:

```ts
const dist = player.transform.distanceTo(enemy); // Actor works
player.transform.lookAt(enemy);                   // Actor works
player.transform.lookAt({ x: 10, y: 0, z: 5 });  // Vector3Like also works
```

#### `Transform.resolveTransform(value): Transform` (static)

Extracts the `Transform` from a `TransformLike` value. Returns the
value itself if it is already a `Transform`, otherwise returns
`value.transform`.

### Visibility

#### `getVisible(): boolean`

Returns `true` if the underlying `THREE.Object3D` is visible.

#### `setVisible(visible): Transform`

Sets the visibility of the object. Returns `this` for chaining.

### Local Space

#### `getLocalPosition(position?): Vector3`

Copies the local position into `position` and returns it.
When called without arguments, returns a new `Vector3`.

#### `setLocalPosition(pos): Transform`

Sets the local position directly from `pos`. Returns `this`.

#### `getLocalOrientation(orientation?): Quaternion`

Copies the local quaternion into `orientation` and returns it.
When called without arguments, returns a new `Quaternion`.

#### `setLocalOrientation(quaternion): Transform`

Sets the local quaternion directly from `quaternion`. Returns `this`.

#### `getLocalEulerAngles(angles?): Euler`

Copies the local Euler angles into `angles` and returns them.
When called without arguments, returns a new `Euler`.

#### `setLocalEulerAngles(eulerAngles): Transform`

Sets the local orientation from Euler angles. Returns `this`.

#### `getLocalScale(scale?): Vector3`

Copies the local scale into `scale` and returns it.
When called without arguments, returns a new `Vector3`.

#### `setLocalScale(scale): Transform`

Sets the local scale directly from `scale`. Returns `this`.

#### `moveLocal(offset): Transform`

Translates the object by `offset` in local (parent) space. Returns `this`.

#### `moveOriented(offset): Transform`

Translates the object by `offset` oriented along the object's own
rotation. Useful for "move forward" style movement where the offset
is relative to the object's facing direction. Returns `this`.

#### `rotateLocal(quaternion): Transform`

Applies a rotation in the object's local space. Returns `this`.

#### `rotateLocalEulerAngles(eulerAngles): Transform`

Converts `eulerAngles` to a quaternion and applies a local rotation.
Returns `this`.

### Global Space

#### `getGlobalMatrix(matrix?): Matrix4`

Copies the world matrix into `matrix` and returns it.
When called without arguments, returns a new `Matrix4`.

#### `setGlobalMatrix(matrix): Transform`

Decomposes `matrix` into position, orientation, and scale, converting
from world space to local space relative to the parent. No-op if the
object has no parent. Returns `this`.

#### `getGlobalPosition(position?): Vector3`

Extracts the world position into `position` and returns it.
When called without arguments, returns a new `Vector3`.

#### `setGlobalPosition(pos): Transform`

Converts `pos` from world space to the parent's local space and
applies it. No-op if the object has no parent. Returns `this`.

#### `getGlobalOrientation(orientation?): Quaternion`

Computes the world-space quaternion into `orientation` and returns it.
When called without arguments, returns a new `Quaternion`.

#### `setGlobalOrientation(quaternion): Transform`

Converts a world-space `quaternion` to local space relative to the
parent and applies it. No-op if the object has no parent. Returns `this`.

#### `getGlobalEulerAngles(angles?): Euler`

Computes the world-space Euler angles into `angles` and returns them.
When called without arguments, returns a new `Euler`.

#### `setGlobalEulerAngles(eulerAngles): Transform`

Converts world-space Euler angles to a local quaternion relative to
the parent and applies it. No-op if the object has no parent.
Returns `this`.

#### `getParentGlobalOrientation(): Quaternion`

Walks the ancestor chain and returns the accumulated world-space
quaternion of all parents (excluding the object itself).

#### `moveGlobal(offset): Transform`

Translates the object by `offset` in world space. Returns `this`.

#### `rotateGlobal(quaternion): Transform`

Applies a rotation in world space. The current global orientation is
pre-multiplied by `quaternion`. Returns `this`.

#### `rotateGlobalEulerAngles(eulerAngles): Transform`

Converts `eulerAngles` to a quaternion and applies a global rotation.
Returns `this`.

#### `lookAt(target, up?): Transform`

Rotates the object so it faces `target`. Accepts a world-space point
(`Vector3Like`), a `Transform`, or any object with a `.transform`
property (such as an `Actor`). An optional `up` vector can be provided;
defaults to the object's own up. Returns `this`.

#### `lookTowards(direction, up?): Transform`

Rotates the object so its forward axis aligns with `direction`
(world-space direction vector). Internally calls `lookAt`.
Returns `this`.

### Direction Helpers

#### `getForward(target?): Vector3`

Returns the object's local -Z axis in world space (Three.js convention).
When called without arguments, returns a new `Vector3`.

#### `getRight(target?): Vector3`

Returns the object's local +X axis in world space.
When called without arguments, returns a new `Vector3`.

#### `getUp(target?): Vector3`

Returns the object's local +Y axis in world space.
When called without arguments, returns a new `Vector3`.

#### `moveForward(distance): Transform`

Moves the object along its forward direction by `distance` units.
Returns `this`.

#### `moveRight(distance): Transform`

Moves the object along its right direction by `distance` units.
Returns `this`.

#### `moveUp(distance): Transform`

Moves the object along its up direction by `distance` units.
Returns `this`.

### Utility

#### `distanceTo(other): number`

Computes the world-space distance between this transform and `other`.
Accepts a `Transform` or any object with a `.transform` property
(such as an `Actor`).

#### `lerpPosition(target, alpha): Transform`

Linearly interpolates the local position toward `target` by `alpha`
(0 = no change, 1 = snap to target). Returns `this`.

#### `slerpOrientation(target, alpha): Transform`

Spherically interpolates the local orientation toward `target` by
`alpha` (0 = no change, 1 = snap to target). Returns `this`.
