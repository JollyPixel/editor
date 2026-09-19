# PeerFrustums

Actor component that draws every remote peer's camera frustum, labelled and
colored from the peer profile.

```ts
const frustums = world
  .createActor("peer-frustums")
  .addComponentAndGet(PeerFrustums, {
    room,
    camera: orbitCamera.threeCamera as THREE.PerspectiveCamera
  });

orbitCamera.teleport(frustums.poseOf(clientId));
```

It wraps `PeerFrustumSync` from `@jolly-pixel/three/network`. The local camera
is attached on `awake()`, so create the actor before the scene awakes.
Frustums closer than 1.5 units are hidden and fade in up to 5 units.

`poseOf(clientId)` returns the peer's last published pose, or `undefined` when
the peer has published none. `destroy()` removes every frustum.
