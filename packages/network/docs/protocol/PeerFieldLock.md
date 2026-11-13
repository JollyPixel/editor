# Peer field lock

A field lock is the path of the field a peer is editing, published in its
presence under `PEER_FIELD_LOCK_KEY` (`"fieldLock"`). Editors show the field
as taken, and other peers wait before writing it. The server does not enforce
it. Each editor chooses its paths, such as `material:<id>:color` in the
voxel-model editor.

```ts
import {
  PEER_FIELD_LOCK_KEY,
  parsePeerFieldLock
} from "@jolly-pixel/network/client";

room.updatePresence({ [PEER_FIELD_LOCK_KEY]: "material:m1:color" });
room.updatePresence({ [PEER_FIELD_LOCK_KEY]: null });

const path = parsePeerFieldLock(room.peers.get(clientId)?.presence);
```

## `parsePeerFieldLock(presence)`

Reads the path a peer holds, or `null` when it holds none or the value is not
a string. It never throws.
