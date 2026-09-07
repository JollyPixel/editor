# Peer frustums

`PeerFrustum` is a wireframe camera shape. `PeerFrustumSync` publishes an
attached object's pose through `@jolly-pixel/network` and creates one frustum
for each remote pose.

## Standalone frustum

```ts
import { PeerFrustum } from "@jolly-pixel/three";

const frustum = new PeerFrustum({
  color: "#43aa8b",
  displayName: "Alice",
  showNameBox: true
});

frustum.position.copy(remotePosition);
frustum.quaternion.copy(remoteQuaternion);
scene.add(frustum);
```

The shape points down local `-Z`.

| Option | Default | Purpose |
|---|---:|---|
| `fov` | `50` | Vertical field of view in degrees |
| `aspect` | `16 / 9` | Width-to-height ratio |
| `depth` | `1.5` | Far rectangle distance in world units |
| `near` | `depth * 0.2` | Near rectangle distance; must be above `0` and below `depth` |
| `color` | `"#43aa8b"` | Wireframe and label accent |
| `showApex` | `false` | Connect the origin to the near rectangle |
| `displayName` | none | Create a billboard label |
| `showNameBox` | `false` | Draw a dark rounded label background |

`color`, `displayName`, `opacity`, and `showNameBox` can be assigned after
construction.
The `label` property is `null` until a display name is provided. Call
`removeFromParent()` and `dispose()` during teardown.

`PeerFrustum.Defaults` contains the process-wide defaults used by new
instances.

`PeerFrustumLabel` is also exported for standalone labels. Its constructor
requires `displayName` and `color`; `showNameBox` defaults to `false`. Those
three fields and `opacity` are assignable properties. It extends `THREE.Sprite`
and exposes `dispose()`.

## Sync room presence

```ts
import * as network from "@jolly-pixel/network/client";
import { PeerFrustumSync } from "@jolly-pixel/three/network";

const client = new network.Client({ identity: { username } });
const room = client.room("my-room");
room.join();

const sync = new PeerFrustumSync({ room, parent: scene });
sync.attach(camera);

renderer.setAnimationLoop(() => {
  sync.update();
  renderer.render(scene, camera);
});
```

| Option | Default | Purpose |
|---|---:|---|
| `room` | required | Room used for presence |
| `parent` | required | Parent for remote frustums |
| `presenceKey` | `"frustum"` | Presence field for poses |
| `throttleMs` | `50` | Minimum delay between changed pose reports; `0` reports every change |
| `hideWithin` | `0` | Distance from the source below which a frustum is hidden |
| `fadeWithin` | `0` | Distance from the source below which a frustum fades toward hidden |
| `label` | `identity.username` | Resolve a remote display name |
| `color` | deterministic peer color | Resolve a remote color |
| `frustum` | `{}` | Shared `PeerFrustum` options except `color` and `displayName` |

Call `update()` once per render tick. It publishes after a position or
quaternion component changes by more than `1e-4` and the throttle interval has
elapsed.

## Proximity fade

A frustum you stand inside reads as noise on screen, so `update()` fades each
peer by its distance to the attached source: opaque at `fadeWithin` and beyond,
ramping linearly to hidden at `hideWithin`. Both default to `0`, which leaves
every frustum opaque; opt in by setting them. A pose landing next to the source
fades on arrival rather than on the next tick, and `detach()` restores full
opacity.

The fade drives `PeerFrustum.opacity`, which spans the wireframe and its label,
clamps to `0..1`, and turns the line material transparent below `1`.

`poseOf(clientId)` returns a copy of the last pose applied to a peer, or
`undefined` for an unknown peer, one whose pose is missing or malformed, and
one that has left. Use it to move a local camera onto a peer's viewpoint.

`detach()` stops local pose reports but leaves remote frustums visible.
`refreshColors()` reruns the color callback for current peers. `destroy()`
detaches, removes room listeners, and disposes remote frustums.

The entry point exports `PeerFrustumPose` and
`decodePeerFrustumPose(value)`. The decoder returns `undefined` unless the
value contains numeric position `x`, `y`, `z` fields and quaternion `x`, `y`,
`z`, `w` fields. A missing or malformed remote pose hides its frustum.

The related exported types are `PeerFrustumOptions`, `PeerFrustumDefaults`,
`PeerFrustumLabelOptions`, `PeerFrustumSyncOptions`, and `PeerFrustumPose`.
