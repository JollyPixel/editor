# Presence and locking

The core package depends on nothing network related. It declares a
`PresenceSource` port and owns the presence schema. An adapter for
`@jolly-pixel/network` ships under the `./network` subpath.

## `CollaboratorPresence`

```ts
interface CollaboratorPresence {
  clientId: string;
  displayName: string;
  color: string;
  editing?: string; // field path this peer holds
}
```

## `PresenceSource`

```ts
interface PresenceSource {
  readonly clientId: string;
  readonly peers: ReadonlyMap<string, CollaboratorPresence>; // local peer included
  claim(path: string): LockState;
  release(path: string): void;
  on(event: "change", listener: () => void): void;
  off(event: "change", listener: () => void): void;
}

type LockState = "held" | "denied" | "contended";
```

- A client holds one path at a time: `claim` replaces the previous one.
- `"contended"`: a remote peer already holds the path. The claim goes through
  anyway. Locks are advisory, and the data layer resolves writes, last write
  wins.
- `"denied"` has no producer in a presence-backed source. It leaves room for a
  server-granted lease.

## Wiring a pane

```ts
pane.presence = source;
```

```ts
html`<jolly-number path="map.width" .value=${width}></jolly-number>`;
```

- Fields find the nearest ancestor's source when they connect, so one property
  turns on locking for the whole subtree. Without a source, fields never lock.
- `path` is supplied by the consumer. Do not derive it from a label or DOM
  position: two clients would only agree while their trees are identical.
- A field with `path === null`, the default, never claims.
- A focused field publishes its path. Other clients show it locked in the
  holder's colour.
- The local peer never locks its own field. Local focus beats a remote claim:
  contention shows as a peer chip, not a lock bar.
- A claim releases on blur, on disconnection, and when `path` changes. A peer's
  claims disappear when it leaves.

## Mapping

`jolly-presence` reads no source: the host pushes snapshots into it.

```ts
const repaint = () => presence.update(
  toPresencePeers(source.peers.values(), source.clientId)
);
source.on("change", repaint);
repaint();
```

`toPresencePeers(peers, selfId)` flags the local peer and puts it first, then
sorts by `clientId`, so every client shows the same order.

## `RoomPresenceSource`

```ts
import { RoomPresenceSource } from "@jolly-pixel/ui/network";

const source = new RoomPresenceSource(room);
```

- `@jolly-pixel/network` is an optional peer dependency. The subpath imports
  its `./client` entry, which keeps the server and `ws` out of browser bundles.
- Peers are keyed by connection: two tabs of one account are two peers.
- `clientId` is `room.clientId`, `""` until admitted.
- Names and colours come from
  [`toPresencePeer`](./identity.md#profile-helpers).
- Claims travel under the `fieldLock` presence key.
- `dispose()` detaches from the room.
