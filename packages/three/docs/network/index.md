# Network

`@jolly-pixel/three/network` exports components that integrate with
`@jolly-pixel/network`. It is an optional peer dependency, so applications that
use this entry point must install it.

## Components

- [`PeerFrustumSync`](PeerFrustumSync.md) publishes an `Object3D` pose and
  renders remote poses with [`PeerFrustum`](../PeerFrustum.md).

## Pose helpers

These exports describe and decode the presence value used by
`PeerFrustumSync`:

```ts
interface PeerFrustumPose {
  position: THREE.Vector3Like;
  quaternion: THREE.QuaternionLike;
}

function decodePeerFrustumPose(
  value: unknown
): PeerFrustumPose | undefined;
```

`decodePeerFrustumPose` returns `undefined` unless `value` has numeric `x`,
`y`, and `z` position fields and numeric `x`, `y`, `z`, and `w` quaternion
fields.
