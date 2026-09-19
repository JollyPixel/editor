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

## Profile helpers

Available under the `./network` subpath:

| Function | What it does |
|---|---|
| `toPeerMetadata(identity)` | The `{ username, peerId }` profile to pass to `new Client({ profile })`. |
| `readUsername(profile)` | The profile's `username`, or `"Guest"`. |
| `readPeerId(profile)` | The profile's `peerId`, or `undefined`. |
| `peerProfileColor(clientId, profile)` | The color of the published `peerId`, falling back to `clientId`, so every peer computes the same color for the same identity. |
