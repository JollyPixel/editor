## Transform

Wrapper around a `THREE.Object3D` that exposes a clean API for reading and
writing an actor's position, orientation, and scale in both local and global
space. Every `Actor` owns a `Transform` accessible via `actor.transform`.

```ts
import * as THREE from "three";
import { Actor } from "@jolly-pixel/engine";

const actor = new Actor(gameInstance, "Player");

// Read global position
const pos = actor.transform.getGlobalPosition(new THREE.Vector3());
console.log(pos.x, pos.y, pos.z);

// Move the actor 5 units forward in local space
actor.transform.moveLocal(new THREE.Vector3(0, 0, -5));

// Rotate 45° around the Y axis (global)
const rotation = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, 1, 0),
  Math.PI / 4
);
actor.transform.rotateGlobal(rotation);

// Make the actor look at a target
actor.transform.lookAt(new THREE.Vector3(10, 0, 10));
```

### Visibility

#### `getVisible(): boolean`

Returns `true` if the underlying `THREE.Object3D` is visible.

#### `setVisible(visible): Transform`

Sets the visibility of the object. Returns `this` for chaining.

### Local Space

#### `getLocalPosition(position): Vector3`

Copies the local position into `position` and returns it.

#### `setLocalPosition(pos)`

Sets the local position directly from `pos`.

#### `getLocalOrientation(orientation): Quaternion`

Copies the local quaternion into `orientation` and returns it.

#### `setLocalOrientation(quaternion)`

Sets the local quaternion directly from `quaternion`.

#### `getLocalEulerAngles(angles): Euler`

Copies the local Euler angles into `angles` and returns them.

#### `setLocalEulerAngles(eulerAngles)`

Sets the local orientation from Euler angles.

#### `getLocalScale(scale): Vector3`

Copies the local scale into `scale` and returns it.

#### `setLocalScale(scale)`

Sets the local scale directly from `scale`.

#### `moveLocal(offset)`

Translates the object by `offset` in local (parent) space.

#### `moveOriented(offset)`

Translates the object by `offset` oriented along the object's own
rotation. Useful for "move forward" style movement where the offset
is relative to the object's facing direction.

#### `rotateLocal(quaternion)`

Applies a rotation in the object's local space.

#### `rotateLocalEulerAngles(eulerAngles)`

Converts `eulerAngles` to a quaternion and applies a local rotation.

### Global Space

#### `getGlobalMatrix(matrix): Matrix4`

Copies the world matrix into `matrix` and returns it.

#### `setGlobalMatrix(matrix)`

Decomposes `matrix` into position, orientation, and scale, converting
from world space to local space relative to the parent. No-op if the
object has no parent.

#### `getGlobalPosition(position): Vector3`

Extracts the world position into `position` and returns it.

#### `setGlobalPosition(pos)`

Converts `pos` from world space to the parent's local space and
applies it. No-op if the object has no parent.

#### `getGlobalOrientation(orientation): Quaternion`

Computes the world-space quaternion into `orientation` and returns it.

#### `setGlobalOrientation(quaternion)`

Converts a world-space `quaternion` to local space relative to the
parent and applies it. No-op if the object has no parent.

#### `getGlobalEulerAngles(angles): Euler`

Computes the world-space Euler angles into `angles` and returns them.

#### `setGlobalEulerAngles(eulerAngles)`

Converts world-space Euler angles to a local quaternion relative to
the parent and applies it. No-op if the object has no parent.

#### `getParentGlobalOrientation(): Quaternion`

Walks the ancestor chain and returns the accumulated world-space
quaternion of all parents (excluding the object itself).

#### `moveGlobal(offset)`

Translates the object by `offset` in world space.

#### `rotateGlobal(quaternion)`

Applies a rotation in world space. The current global orientation is
pre-multiplied by `quaternion`.

#### `rotateGlobalEulerAngles(eulerAngles)`

Converts `eulerAngles` to a quaternion and applies a global rotation.

#### `lookAt(target, up?)`

Rotates the object so it faces `target` (world-space point).
An optional `up` vector can be provided; defaults to the object's
own up.

#### `lookTowards(direction, up?)`

Rotates the object so its forward axis aligns with `direction`
(world-space direction vector). Internally calls `lookAt`.
