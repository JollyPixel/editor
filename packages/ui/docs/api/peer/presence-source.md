# Presence and locking

`ui` core depends on nothing network related. It declares a port, owns the
presence schema, and ships an adapter for `@jolly-pixel/network` behind a
separate subpath.

## `CollaboratorPresence`

```ts
interface CollaboratorPresence {
  clientId: string;
  displayName: string;
  color: string;
  /** Field path this peer currently holds. */
  editing?: string;
}
```

Display names and colors come from each peer's room profile, so every client
computes the same color for the same `peerId`.

## `PresenceSource`

```ts
interface PresenceSource {
  readonly clientId: string;
  readonly peers: ReadonlyMap<string, CollaboratorPresence>;
  claim(path: string): LockState;
  release(path: string): void;
  on(event: "change", listener: () => void): void;
  off(event: "change", listener: () => void): void;
}

type LockState = "held" | "denied" | "contended";
```

`peers` includes the local peer. An adapter over a transport that omits the
caller from its own peer list synthesizes that entry.

A client edits one path at a time: `claim` replaces the path it claimed before.
It returns `"contended"` when a remote peer already advertises the path,
and claims anyway: locks are advisory, and correctness comes from last write
wins at the data layer. `"denied"` has no producer in a presence-backed source.
It exists so a server-granted lease can replace the implementation without
touching any component.

A field with no ancestor providing a source has none, and renders normally
without ever locking.

## Wiring a pane

```ts
pane.presence = source;
```

Fields ask the nearest ancestor for a source when they connect, so setting this
one property lights up locking across the whole subtree. Give each field the
path it claims:

```ts
html`<jolly-number path="map.width" .value=${width}></jolly-number>`;
```

`path` is consumer supplied and never derived. A path derived from a label or a
DOM position collides silently, and two clients only agree on one when both
render an identical tree — which stops being true as soon as a selection is
involved. A field with `path === null`, the default, never claims and never
locks.

While focused, a field publishes its path and other clients render it locked in
the holder's color. The local peer never locks its own field, and local focus
beats a remote claim: contention shows as a peer chip rather than a lock bar, so
neither user loses the field they are typing in. Chips name other peers only; a
field never shows a chip for its own user.

A claim releases on blur, on disconnection, and when `path` changes under a
focused field. A peer's claims also disappear with `peer-left`, so a closed tab
needs no cleanup.

## Mapping

`jolly-presence` is transport free by design, so a host pushes snapshots into it
rather than the element reading a source:

```ts
const repaint = () => presence.update(
  toPresencePeers(source.peers.values(), source.clientId)
);
source.on("change", repaint);
repaint();
```

`toPresencePeers` flags the local peer and orders the list self first, then by
`clientId`. Insertion order would differ per client, since each one sees the
others join in a different sequence.

Locks are per field and derived, which is why one property lights them up.
Avatars are a whole-session snapshot a host may want to filter or relabel, which
is why they are pushed.

## `RoomPresenceSource`

```ts
import { RoomPresenceSource } from "@jolly-pixel/ui/network";

const source = new RoomPresenceSource(room);
```

Available under the `./network` subpath, which imports `@jolly-pixel/network`'s
`./client` entry — the root entry pulls `Server.ts` and its `ws` dependency into
a browser bundle. `@jolly-pixel/network` is an optional peer dependency: core
never imports it.

Peers are keyed by connection: `clientId` is `room.clientId`, or `""` until the
join is admitted, and remote peers use the ids of `room.peers`. Two tabs of
the same account are two peers and lock each other out. Names and colors are
read from profiles with [`toPresencePeer`](./identity.md#topresencepeerpeer),
the local one from `room.profile`.

A claim travels under the `fieldLock` presence key. Peers that never claimed
are listed without `editing`.

`dispose()` detaches from the room and drops its listeners.
