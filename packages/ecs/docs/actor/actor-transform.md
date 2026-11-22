# Transform

`actor.transform` reads and writes the actor's position, orientation and
scale, in local (parent) or global (world) space. ECS owns these
values: every change is pushed to the actor's
[scene graph node](../systems/scene-graph.md), and world matrices are
computed by the transform itself.

Values are plain objects: `Vector3Like` (`{ x, y, z }`), `QuaternionLike`
(`{ x, y, z, w }`) and `EulerLike` (`{ x, y, z }`, radians, XYZ order). A
three.js `Vector3` or `Quaternion` is accepted wherever one is expected. A
three.js `Euler` is read in XYZ order whatever its `order` says. Matrices are
`Mat4`: 16 numbers in column-major order, the layout of three.js
`Matrix4.elements`. The package exports these types.

Code that computes with pmndrs `math` tuples converts at the edge with
`loadVector3(out, value)`, `loadQuaternion(out, value)` and
`loadMatrix(out, value)`, which fill a tuple, and `writeVector3(out, value)`
and `writeQuaternion(out, value)`, which fill a plain object. Each returns
`out`. `decomposeMatrix(matrix, position, quaternion, scale)` splits a `Mat4`
into tuples like three.js `Matrix4.decompose`: a mirrored matrix gets a
negative x scale.

`transform.local` and `transform.global` expose the pose in each space
as properties. Reading one returns a read-only copy owned by the transform:
it is overwritten by the next read of the same property, and mutating it never
moves the transform. Assign to write, or call the space's `move` and `rotate`.
Mutating methods return `this`.

```ts
import { Actor } from "@jolly-pixel/ecs";

const actor = new Actor(world, { name: "Player" });

const { x, y, z } = actor.transform.global.position;

// Keep a value across reads
const saved = { ...actor.transform.global.position };
const matrix = [...actor.transform.global.matrix];

actor.transform.local.position = { x: 0, y: 1, z: 0 };
actor.transform.visible = true;

// Move the actor 5 units forward
actor.transform.moveForward(5);

// Rotate 45° around the Y axis (global)
const half = Math.PI / 8;
actor.transform.global.rotate({ x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) });

// Make the actor look at a target
actor.transform.lookAt({ x: 10, y: 0, z: 10 });

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

`false` when the transform or one of its ancestors is hidden.

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
  readonly matrix: Mat4;
}
```

The transform reads `matrix` and never writes it.

### `detach(): void`

Forgets the parent and socket without touching the node, and marks the
global matrix stale. Destruction calls it.

## Local Space

`transform.local` is a `LocalSpace`: the pose relative to the parent.

```ts
interface LocalSpace {
  position: Readonly<Vector3Like>;
  orientation: Readonly<QuaternionLike>;
  eulerAngles: Readonly<EulerLike>;
  scale: Readonly<Vector3Like>;
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
  matrix: Readonly<Mat4>;
  position: Readonly<Vector3Like>;
  orientation: Readonly<QuaternionLike>;
  eulerAngles: Readonly<EulerLike>;
  readonly forward: Readonly<Vector3Like>; // local -Z (three.js convention)
  readonly right: Readonly<Vector3Like>; // local +X
  readonly up: Readonly<Vector3Like>; // local +Y
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
`TransformLike`. `up` defaults to the world +Y axis.

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
