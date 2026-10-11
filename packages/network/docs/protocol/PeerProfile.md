# Peer profile

A profile is free-form `PeerMetadata`. The client claims one with
`new Client({ profile })` and the server can override it. `peer.profile`
exposes what was admitted; `room.profile` is the claim until the first `sync`.
The fields below are the convention every JollyPixel package writes and reads.

```ts
import {
  Client,
  parsePeerProfile,
  type PeerProfileMetadata
} from "@jolly-pixel/network/client";

const claim: PeerProfileMetadata = {
  username: "Ada",
  peerId: "4f1c9a2e-0b7d-4d3e-9a51-2c8f6e0d7b14"
};
const client = new Client({ profile: claim });

const room = client.room("lobby");
room.on("sync", () => {
  console.log(parsePeerProfile(room.profile).username);
});
```

## `PeerProfileMetadata`

```ts
type PeerProfileMetadata = {
  username: string;
  peerId?: string;
  avatar?: string | null;
  via?: string;
};
```

The shape to publish. `peerId` is the stable identity of the person, the same
across tabs and reconnects, unlike the per-connection `clientId`. `avatar` is
written by the server only, and `null` clears it. `via` names how a guest got
in, such as `"link"` for a share link.

## `parsePeerProfile(metadata)`

Reads a profile into a readonly `PeerProfile` with the same four fields. It
never throws: a field of the wrong type reads as `undefined`, and a missing or
malformed `username` reads as `GUEST_USERNAME` (`"Guest"`). `avatar` is kept
only when it is a same-origin path, starting with a single `/`, so a peer
cannot point other clients at another origin. `metadata` may be `undefined`,
as `room.peers.get(clientId)?.profile` is for a peer that already left.
