# Peer identity

```ts
interface PeerIdentity {
  username: string;
  peerId: string;
  color: string; // derived from peerId
  avatar?: string; // same-origin path of an uploaded image
}
```

## `promptPeerIdentity(options): Promise<PeerIdentity>`

```ts
interface PromptPeerIdentityOptions {
  title: string;
  storageKey: string;
  storage?: StorageAdapter; // default: sessionStorage
}

const identity = await promptPeerIdentity({
  title: "Join voxel map",
  storageKey: "voxel-map:username"
});
```

- Asks for a username once per tab and reuses it.
- An empty answer gives `GUEST_USERNAME` (`"Guest"`).
- `peerId` is a fresh UUID.

## `peerIdentity(username, peerId?, avatar?): PeerIdentity`

```ts
const guest = peerIdentity("Guest");
const joined = peerIdentity("alice", launch.peerId);
const identity = peerIdentity(account.username, account.id, account.avatar);
```

- The same `peerId` always gets the same `color`.
- `peerId` defaults to a fresh UUID.
- Without `avatar`, the identity has none.

## Profile helpers

From the `./network` subpath.

### `toPeerProfileMetadata(identity): PeerProfileMetadata`

The `{ username, peerId }` profile for `new Client({ profile })`. It leaves
`avatar` out: only the server can set one.

### `peerProfileColor(clientId, profile): string`

The colour of the published `peerId`, or of `clientId` without one.

### `toPresencePeer(member: RoomMember): PresencePeer`

A room peer as a `PresencePeer`: named by `username`, coloured by
`peerProfileColor`, with the profile's `peerId` and `avatar`. A `via` string,
such as `"link"`, becomes the badge "via link".
