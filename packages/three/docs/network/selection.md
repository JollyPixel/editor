# Selection and hover sync

`PeerSelectionSync` and `PeerHoverSync` publish a local
`SelectionManager` through room presence and apply remote ids to the peer
registries. The renderers remain transport-independent; see
[peer selection and hover](../selection/peers.md).

```ts
import * as network from "@jolly-pixel/network/client";
import {
  PeerHoverRegistry,
  PeerSelectionRegistry,
  SelectionManager
} from "@jolly-pixel/three";
import {
  PeerHoverSync,
  PeerSelectionSync
} from "@jolly-pixel/three/network";

const client = new network.Client({ identity: { username } });
const room = client.room("my-room");
room.join();

const selection = new SelectionManager();
const registry = new PeerSelectionRegistry();
const hoverRegistry = new PeerHoverRegistry();

const selectionSync = new PeerSelectionSync({
  room,
  registry,
  selection
});
const hoverSync = new PeerHoverSync({
  room,
  registry: hoverRegistry,
  selection
});
```

Every client must register the same id for the same scene object. The sync
classes transport ids and do not reconcile scene graphs.

| Class | Presence key | Other defaults |
|---|---|---|
| `PeerSelectionSync` | `"selection"` | `resyncIntervalMs: 5000` |
| `PeerHoverSync` | `"hover"` | `throttleMs: 80`, `resyncIntervalMs: 1000` |

Set either resync interval to `0` to disable reconciliation. Hover throttling
keeps the latest state and sends it after the throttle window.

Call `destroy()` on both sync objects during room teardown. This removes their
listeners and clears the remote peers they added without calling
`room.leave()`.

The entry point also exports `PeerSelectionId`, `PeerHoverId`,
`PeerSelectionSyncOptions`, `PeerHoverSyncOptions`,
`decodePeerSelectionId()`, and `decodePeerHoverId()`. Each decoder accepts a
string or `null`; malformed values return `undefined` and leave the previous
remote state unchanged.
