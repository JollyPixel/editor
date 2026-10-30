# PeerFrustums

Actor component that draws every remote peer's camera frustum, labelled with
the peer's username and tinted with its profile color.

```ts
const frustums = world
  .createActor("peer-frustums")
  .addComponentAndGet(PeerFrustums, {
    room,
    camera: orbitCamera.threeCamera as THREE.PerspectiveCamera
  });

orbitCamera.teleport(frustums.peerPose(clientId));
```

## Options

```ts
interface PeerFrustumsOptions {
  room: Room;
  camera: THREE.PerspectiveCamera;
}
```

`camera` is the local camera, published to the peers of `room`. It is attached
on `awake()`, so create the actor before the scene awakes.

A frustum closer than 1.5 units to the local camera is hidden, and fades in up
to 5 units.

## Methods

```ts
peerPose(clientId: string): PeerFrustumPose | undefined;
```

Returns the peer's last published pose, or `undefined` when the peer has
published none. `PeerFrustumPose` comes from `@jolly-pixel/three/network`.

Destroying the actor removes every frustum.

A remote pose change or a joining peer calls `world.invalidate()`, so a
runtime that [renders on demand](./EditorRuntime.md#methods) draws it.
