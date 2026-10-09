# Peer identity

## `promptPeerIdentity(options)`

```ts
import { promptPeerIdentity } from "@jolly-pixel/ui";

const identity = await promptPeerIdentity({
  title: "Join voxel map",
  storageKey: "voxel-map:username"
});
// { username, peerId, color }
```

Asks for a username once per tab and reuses it from `sessionStorage` under
`storageKey`; pass `storage` to use another `StorageAdapter`. An empty answer
falls back to `GUEST_USERNAME` (`"Guest"`). `peerId` is a fresh UUID and
`color` is derived from it.

## `peerIdentity(username, peerId?, avatar?)`

```ts
import { peerIdentity } from "@jolly-pixel/ui";

const guest = peerIdentity("Guest");
const joined = peerIdentity("alice", launch.peerId);
```

Builds a `PeerIdentity` whose `color` is derived from `peerId`, so the same
peer id always gets the same color. `peerId` defaults to a fresh UUID.

`avatar` is the same-origin path of an uploaded image, which the host passes
when it knows one. The identity leaves `avatar` out without it.

```ts
const identity = peerIdentity(account.username, account.id, account.avatar);
```

## Profile helpers

Available under the `./network` subpath.

### `toPeerMetadata(identity)`

The `{ username, peerId }` profile to pass to `new Client({ profile })`. It
leaves `avatar` out: a client cannot claim an image, only the server can set
one.

### `readUsername(profile)`

The profile's `username`, or `"Guest"`.

### `readPeerId(profile)`

The profile's `peerId`, or `undefined`.

### `readAvatar(profile)`

The profile's `avatar` when it is a same-origin path (starting with a single
`/`), or `undefined`. A server-owned profile sets it, for example from an
account's uploaded image.

### `peerProfileColor(clientId, profile)`

The color of the published `peerId`, falling back to `clientId`, so every peer
computes the same color for the same identity.

### `presencePeerOf(peer)`

The `PresencePeer` of a room peer: named with `readUsername`, colored with
`peerProfileColor`, and carrying the profile's `peerId` and `avatar`.
