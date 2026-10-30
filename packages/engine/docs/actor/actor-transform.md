# Transform

`actor.transform` reads and writes the actor's position, orientation and
scale, in local (parent) or global (world) space.

Setters and mutating methods return `this`. Getters write into the optional
object they are given, or return a new one.

```ts
import * as THREE from "three";
import { Actor } from "@jolly-pixel/engine";

const actor = new Actor(world, { name: "Player" });

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

## TransformLike

Several methods accept a `TransformLike`:

```ts
type TransformLike = Transform | { transform: Transform };
```

An `Actor` is one, so you can pass actors directly:

```ts
const dist = player.transform.distanceTo(enemy); // Actor works
player.transform.lookAt(enemy);                   // Actor works
player.transform.lookAt({ x: 10, y: 0, z: 5 });  // Vector3Like also works
```

### `Transform.resolveTransform(value): Transform` (static)

Returns the `Transform` behind a `TransformLike`.

## Visibility

### `getVisible(): boolean`

Returns `true` if the underlying `THREE.Object3D` is visible.

### `setVisible(visible): Transform`

Sets the visibility of the object.

### `visibleInHierarchy: boolean`

`false` when the object or one of its ancestors is hidden. The same walk over
any `THREE.Object3D` is exported as `isVisibleInHierarchy(object)`.

## Local Space

### `getLocalPosition(position?): Vector3`

Copies the local position into `position` and returns it.

### `setLocalPosition(pos): Transform`

Sets the local position directly from `pos`.

### `getLocalOrientation(orientation?): Quaternion`

Copies the local quaternion into `orientation` and returns it.

### `setLocalOrientation(quaternion): Transform`

Sets the local quaternion directly from `quaternion`.

### `getLocalEulerAngles(angles?): Euler`

Copies the local Euler angles into `angles` and returns them.

### `setLocalEulerAngles(eulerAngles): Transform`

Sets the local orientation from Euler angles.

### `getLocalScale(scale?): Vector3`

Copies the local scale into `scale` and returns it.

### `setLocalScale(scale): Transform`

Sets the local scale directly from `scale`.

### `moveLocal(offset): Transform`

Translates the object by `offset` in local (parent) space.

### `moveOriented(offset): Transform`

Translates the object by `offset` along its own rotation, so the offset is
relative to its facing direction.

### `rotateLocal(quaternion): Transform`

Applies a rotation in the object's local space.

### `rotateLocalEulerAngles(eulerAngles): Transform`

Converts `eulerAngles` to a quaternion and applies a local rotation.

## Global Space

### `getGlobalMatrix(matrix?): Matrix4`

Copies the world matrix into `matrix` and returns it.

### `setGlobalMatrix(matrix): Transform`

Decomposes `matrix` into position, orientation, and scale, converting
from world space to local space relative to the parent. No-op if the
object has no parent.

### `getGlobalPosition(position?): Vector3`

Extracts the world position into `position` and returns it.

### `setGlobalPosition(pos): Transform`

Converts `pos` from world space to the parent's local space and
applies it. No-op if the object has no parent.

### `getGlobalOrientation(orientation?): Quaternion`

Computes the world-space quaternion into `orientation` and returns it.

### `setGlobalOrientation(quaternion): Transform`

Converts a world-space `quaternion` to local space relative to the
parent and applies it. No-op if the object has no parent.

### `getGlobalEulerAngles(angles?): Euler`

Computes the world-space Euler angles into `angles` and returns them.

### `setGlobalEulerAngles(eulerAngles): Transform`

Converts world-space Euler angles to a local quaternion relative to
the parent and applies it. No-op if the object has no parent.

### `getParentGlobalOrientation(orientation?): Quaternion`

Returns the world-space orientation of the parent, or identity when the
object has no parent.

### `moveGlobal(offset): Transform`

Translates the object by `offset` in world space.

### `rotateGlobal(quaternion): Transform`

Applies a rotation in world space. The current global orientation is
pre-multiplied by `quaternion`.

### `rotateGlobalEulerAngles(eulerAngles): Transform`

Converts `eulerAngles` to a quaternion and applies a global rotation.

### `lookAt(target, up?): Transform`

Rotates the object so it faces `target`, a world-space point or a
`TransformLike`. `up` defaults to the object's own up.

### `lookTowards(direction, up?): Transform`

Rotates the object so its forward axis aligns with the world-space
`direction`.

## Direction Helpers

### `getForward(target?): Vector3`

Returns the object's local -Z axis in world space (Three.js convention).

### `getRight(target?): Vector3`

Returns the object's local +X axis in world space.

### `getUp(target?): Vector3`

Returns the object's local +Y axis in world space.

### `moveForward(distance): Transform`

Moves the object along its forward direction by `distance` units.

### `moveRight(distance): Transform`

Moves the object along its right direction by `distance` units.

### `moveUp(distance): Transform`

Moves the object along its up direction by `distance` units.

## Utility

### `distanceTo(other): number`

Returns the world-space distance to `other`, a `TransformLike`.

### `lerpPosition(target, alpha): Transform`

Linearly interpolates the local position toward `target` by `alpha`
(0 = no change, 1 = snap to target).

### `slerpOrientation(target, alpha): Transform`

Spherically interpolates the local orientation toward `target` by
`alpha` (0 = no change, 1 = snap to target).
