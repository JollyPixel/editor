# Transform

`actor.transform` reads and writes the actor's position, orientation and
scale, in local (parent) or global (world) space. The engine owns these
values: every change is pushed to the actor's
[scene graph node](../systems/scene-graph.md), and world matrices are
computed by the transform itself. The math types are three.js ones
(`Vector3`, `Quaternion`, `Matrix4`, `Euler`).

`transform.local` and `transform.global` expose the pose in each space
as properties. Reading one returns a read-only copy owned by the transform:
it is overwritten by the next read of the same property, and mutating it never
moves the transform. Assign to write, or call the space's `move` and `rotate`.
Mutating methods return `this`.

```ts
import * as THREE from "three";
import { Actor } from "@jolly-pixel/engine";

const actor = new Actor(world, { name: "Player" });

const { x, y, z } = actor.transform.global.position;

// Keep a value across reads
const saved = actor.transform.global.position.clone();
const reusable = new THREE.Vector3().copy(actor.transform.global.position);

actor.transform.local.position = { x: 0, y: 1, z: 0 };
actor.transform.visible = true;

// Move the actor 5 units forward
actor.transform.moveForward(5);

// Rotate 45° around the Y axis (global)
const rotation = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(0, 1, 0),
  Math.PI / 4
);
actor.transform.global.rotate(rotation);

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

### `visible: boolean`

The transform's own visibility. Assigning pushes it to the node.

### `visibleInHierarchy: boolean`

`false` when the transform or one of its ancestors is hidden. The same walk
over any `THREE.Object3D` is exported as `isVisibleInHierarchy(object)`.

## Hierarchy

The actor registry keeps the transform hierarchy in step with the actor
tree. These members serve standalone transforms and tests.

### `parent: Transform | null`

The transform this one is attached to.

### `attach(parent, keepWorld?): Transform`

Attaches to `parent`, or to the root with `null`, and drops the socket.
`keepWorld` keeps the global pose instead of the local one.
@default `false`

### `socket: TransformSocket | null`

### `seat(socket): Transform`

A socket is an extra matrix between the parent and the local pose: the global
matrix is `parent × socket × local`. [Scene anchors](../systems/scene-file.md#anchors)
seat anchored actors on one. The node receives the socket and the local
pose separately, so a node's own pose is always the local one.

```ts
interface TransformSocket {
  readonly matrix: Readonly<THREE.Matrix4>;
}
```

### `detach(): void`

Forgets the parent and socket without touching the node, and marks the
global matrix stale. Destruction calls it.

## Local Space

`transform.local` is a `LocalSpace`: the pose relative to the parent.

```ts
interface LocalSpace {
  position: Readonly<Vector3>; // accepts Vector3Like
  orientation: Readonly<Quaternion>; // accepts QuaternionLike
  eulerAngles: Readonly<Euler>;
  scale: Readonly<Vector3>; // accepts Vector3Like
}
```

### `local.place(position, quaternion, scale): LocalSpace`

Sets the local position, orientation and scale in one change.

### `local.move(offset): LocalSpace`

Translates the object by `offset` in local (parent) space.

### `local.rotate(quaternion): LocalSpace`

Applies a rotation in the object's local space.

### `local.rotateEulerAngles(eulerAngles): LocalSpace`

Converts `eulerAngles` to a quaternion and applies a local rotation.

## Global Space

`transform.global` is a `GlobalSpace`: the pose in world space. Assigning
converts the value into the parent's space (parent and socket) and stores the
local result.

```ts
interface GlobalSpace {
  matrix: Readonly<Matrix4>;
  position: Readonly<Vector3>; // accepts Vector3Like
  orientation: Readonly<Quaternion>; // accepts QuaternionLike
  eulerAngles: Readonly<Euler>;
  readonly forward: Readonly<Vector3>; // local -Z (three.js convention)
  readonly right: Readonly<Vector3>; // local +X
  readonly up: Readonly<Vector3>; // local +Y
}
```

### `global.move(offset): GlobalSpace`

Translates the object by `offset` in world space.

### `global.rotate(quaternion): GlobalSpace`

Applies a rotation in world space. The current global orientation is
pre-multiplied by `quaternion`.

### `global.rotateEulerAngles(eulerAngles): GlobalSpace`

Converts `eulerAngles` to a quaternion and applies a global rotation.

## Direction Helpers

### `lookAt(target, up?): Transform`

Rotates the object so it faces `target`, a world-space point or a
`TransformLike`. `up` defaults to the object's own up.

### `lookTowards(direction, up?): Transform`

Rotates the object so its forward axis aligns with the world-space
`direction`.

### `moveOriented(offset): Transform`

Translates the object by `offset` along its own rotation, so the offset is
relative to its facing direction.

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
