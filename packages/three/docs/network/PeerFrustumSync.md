# PeerFrustumSync

`PeerFrustumSync` publishes the pose of an attached `THREE.Object3D` and
creates a [`PeerFrustum`](../PeerFrustum.md) for each remote pose.

## Import

```ts
import {
  PeerFrustumSync,
  type PeerFrustumSyncOptions
} from "@jolly-pixel/three/network";
```

This entry point requires the optional `@jolly-pixel/network` peer dependency.

## Setup

```ts
import * as network from "@jolly-pixel/network/client";
import { PeerFrustumSync } from "@jolly-pixel/three/network";

const client = new network.Client({
  identity: {
    username
  }
});
const room = client.room("my-room");
room.join();

const sync = new PeerFrustumSync({
  room,
  parent: scene
});
sync.attach(camera);

renderer.setAnimationLoop(() => {
  sync.update();
  renderer.render(scene, camera);
});
```

Call `destroy()` when the room or scene is torn down.

## Constructor

```ts
new PeerFrustumSync(options: PeerFrustumSyncOptions)
```

The constructor subscribes to room events. Call `attach()` before reporting a
local pose.

```ts
interface PeerFrustumSyncOptions<
  ClientMessage = unknown,
  ServerMessage = unknown
> {
  room: network.Room<ClientMessage, ServerMessage>;
  parent: THREE.Object3D;
  presenceKey?: string;
  throttleMs?: number;
  getLabel?: (
    clientId: string,
    identity: network.PeerMetadata
  ) => string | undefined;
  getColor?: (
    clientId: string,
    identity: network.PeerMetadata
  ) => THREE.ColorRepresentation;
  frustum?: Omit<PeerFrustumOptions, "color" | "displayName">;
}
```

| Option | Default | Description |
|---|---|---|
| `room` | required | Room used to publish and receive poses. |
| `parent` | required | Object that owns the remote frustums. |
| `presenceKey` | `"frustum"` | Presence field used for poses. Set a different key for each frustum stream in the same room. |
| `throttleMs` | `50` | Minimum delay between changed pose reports, in milliseconds. Set it to `0` to report every change observed by `update()`. |
| `getLabel` | `identity.username` | Returns the name shown on a remote frustum. |
| `getColor` | color derived from `clientId` | Returns the color of a remote frustum. |
| `frustum` | `{}` | Options shared by remote frustums. `color` and `displayName` are controlled by `getColor` and `getLabel`. |

## Methods

### `attach()`

```ts
attach(source: THREE.Object3D): void
```

Starts sampling `source.position` and `source.quaternion`. It throws if another
source is already attached.

### `detach()`

```ts
detach(): void
```

Stops reporting the local pose. Existing remote frustums remain attached to
`parent`.

### `update()`

```ts
update(): void
```

Samples the attached source. A pose is published after any position or
quaternion component changes by more than `1e-4` and the throttle interval has
elapsed. Without an attached source, this method does nothing.

Call it once per render tick.

### `refreshColors()`

```ts
refreshColors(): void
```

Calls `getColor` again for every tracked peer. Colors are otherwise resolved
when each remote frustum is created.

### `destroy()`

```ts
destroy(): void
```

Detaches the source, removes the room listeners, and removes and disposes every
remote frustum.

## Peer identity and colors

The `clientId` passed to `getColor` and `getLabel` is assigned to the remote
connection. It differs from `room.clientId`, which is local to the tab. When a
client must reproduce its own peer-visible color, use a stable identity field
that all peers receive.

Call `refreshColors()` if the application's color mapping changes after peers
join or leave.

## Presence value

Poses are stored under `presenceKey` as plain JSON:

```ts
interface PeerFrustumPose {
  position: THREE.Vector3Like;
  quaternion: THREE.QuaternionLike;
}
```

Missing or malformed poses hide the corresponding frustum. They do not remove
it. Use [`decodePeerFrustumPose`](index.md#pose-helpers) when reading the same
presence field elsewhere.
