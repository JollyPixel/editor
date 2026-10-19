# Selection and hover sync

`PeerHighlightSync` publishes the local selection and hover of a
`MeshHighlight` through room presence, and applies remote ones to
`highlight.peers`. The renderers stay transport-independent; see
[peer selection and hover](../mesh-highlight/peers.md).

```ts
import * as network from "@jolly-pixel/network/client";
import { MeshHighlight } from "@jolly-pixel/three";
import { PeerHighlightSync } from "@jolly-pixel/three/network";

const client = new network.Client({ identity: { username } });
const room = client.room("my-room");
room.join();

const highlight = new MeshHighlight({ renderer, scene, camera });
const sync = new PeerHighlightSync({ room, highlight });
```

Every client must register the same id for the same scene object. The sync
transports ids and does not reconcile scene graphs.

```ts
interface PeerHighlightSyncOptions {
  room: Room;
  highlight: MeshHighlight;
  selectionKey?: string;    // default "selection"
  hoverKey?: string;        // default "hover"
  hoverThrottleMs?: number; // default 80
}
```

- Each role reads its key through `network.PresenceChannel`.
- Hover throttling keeps the latest hover and sends it once the window ends.
- A peer missing from both keys, for example after it leaves the room, is
  removed with `peers.removePeer()`, which releases its color.

### destroy(): void

Removes the listeners, drops a pending hover, and clears the remote peers this
instance applied. It does not call `room.leave()`.

The entry point also exports `PeerObjectId` and `decodePeerObjectId()`. The
decoder accepts a string or `null`; a malformed value returns `undefined`,
which clears that peer's mark.
