# Room roster and peer marks

Adapters over a `@jolly-pixel/network` room, from `@jolly-pixel/ui/network`.
They push plain snapshots through a `publish` callback, so the editor decides
where the state lives.

## `PeerRoster`

```ts
interface PeerRosterOptions {
  room: Room;
  publish: (peers: readonly PresencePeer[]) => void;
  log?: LogQueue;
}

const roster = new PeerRoster({
  room,
  publish: (peers) => {
    presenceElement.peers = peers;
  },
  log
});
```

- `peers` lists the local peer first (`self: true`), then remote peers by
  `clientId`, each built by
  [`toPresencePeer`](./identity.md#profile-helpers).
- The local peer is keyed by `room.clientId` (`""` until admitted) and read
  from `room.profile`.
- Republishes on `sync`, `peer-joined`, `peer-left` and `peer-profile`.
- With `log`, pushes a "has joined" or "has left" entry per remote peer.
  Peers already present at `sync` are not announced.
- `dispose()` unsubscribes and publishes an empty list.

## `PeerMarkTracker`

Publishes one local key under `presenceKey` and folds every remote peer's key
into a `PeerMarkMap`.

```ts
interface PeerMarkTrackerOptions<TKey> {
  room: Room;
  presenceKey: string;
  localKey: () => TKey | null;
  readKey: (value: unknown) => TKey | null; // null: the peer marks nothing
  publish: (marks: PeerMarkMap<TKey>) => void;
}

type PeerMarkMap<TKey> = ReadonlyMap<TKey, readonly PresencePeer[]>;

const tracker = new PeerMarkTracker<string>({
  room,
  presenceKey: "block",
  localKey: () => selectedId,
  readKey: (value) => typeof value === "string" ? value : null,
  publish: (marks) => {
    store.blockSelections = marks;
  }
});
```

- Buckets are sorted by `clientId`. The local peer never appears.
- Call `publishLocal()` after the local key changes. An unchanged key is not
  sent again.
- `dispose()` unsubscribes and publishes an empty map.

## `markedPeers(room, values): MarkedPeer[]`

Pairs each presence value with its sender, sorted by `clientId`. Skips `null`
values and senders not in `room.peers`.

## `peerMarks(marked): PeerMarkMap`

Folds `[peer, key]` pairs into a map, keeping their order. `PeerMarkTracker`
publishes `peerMarks(markedPeers(room, values))`. Use them directly when a
presence value carries more than a key:

```ts
const cursors = markedPeers(room, channel.values);
const marks = peerMarks(
  cursors.map(([peer, cursor]): MarkedPeer<string> => [peer, cursor.clip])
);
```

## `peerBadges(key, marks): TreeBadge[]`

The peers marking `key`, as [`jolly-tree` badges](../data/tree.md#row-content):
at most three, in bucket order, coloured and titled per peer.

```ts
const node = {
  ...layerNode,
  badges: peerBadges(layerNode.id, marks)
};
```
