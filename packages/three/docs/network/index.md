# Network

`@jolly-pixel/three/network` exports components that integrate with
`@jolly-pixel/network`. It is an optional peer dependency, so applications that
use this entry point must install it.

## Components

- [`PeerFrustumSync`](PeerFrustumSync.md) publishes an `Object3D` pose and
  renders remote poses with [`PeerFrustum`](../PeerFrustum.md).
- [`PeerSelectionSync`](PeerSelectionSync.md) publishes the local
  `SelectionManager`'s selected id and applies remote peers' selections into
  a [`PeerSelectionRegistry`](../PeerSelectionRegistry.md).
- [`PeerHoverSync`](PeerHoverSync.md) publishes the local
  `SelectionManager`'s hovered id and applies remote peers' hovers into a
  [`PeerHoverRegistry`](../PeerHoverRegistry.md), throttled with a trailing
  flush since hover is event-driven rather than polled.

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

## Selection helpers

These exports describe and decode the presence value used by
`PeerSelectionSync`:

```ts
type PeerSelectionId = string | null;

function decodePeerSelectionId(
  value: unknown
): PeerSelectionId | undefined;
```

`decodePeerSelectionId` returns the value unchanged for a string or `null`,
and `undefined` for anything else - a missing or malformed presence value,
left alone rather than treated as "nothing selected".

## Hover helpers

These exports describe and decode the presence value used by
`PeerHoverSync`:

```ts
type PeerHoverId = string | null;

function decodePeerHoverId(
  value: unknown
): PeerHoverId | undefined;
```

Same decode rules as `decodePeerSelectionId`, for the hover presence field
instead.
