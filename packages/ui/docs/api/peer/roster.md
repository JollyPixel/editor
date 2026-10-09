# Room roster and peer marks

Two adapters over a `@jolly-pixel/network` room, exported from
`@jolly-pixel/ui/network`. Both push plain snapshots through a `publish`
callback, so the editor decides where the state lives.

## `PeerRoster`

```ts
const roster = new PeerRoster({
  room,
  identity,
  publish: (peers) => {
    presenceElement.peers = peers;
  },
  log
});
```

`peers` is a `PresencePeer[]` with the local peer first (`self: true`, built
from `identity`) and remote peers sorted by `clientId`. Names, colors and
avatars are read from each peer's profile with `readUsername`,
`peerProfileColor`, `readPeerId` and `readAvatar`. The local avatar comes from
`identity.avatar`.

The roster republishes on `sync`, `peer-joined` and `peer-left`. With a `log`,
it pushes one "has joined" or "has left" entry per remote peer; members already
present at `sync` are not announced. `dispose()` unsubscribes and publishes an
empty list.

## `PeerMarkTracker`

```ts
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

Publishes one local key under `presenceKey` and folds every remote peer's key
into a `PeerMarkMap<TKey>`, a `ReadonlyMap<TKey, readonly PresencePeer[]>`
whose buckets are sorted by `clientId`. `readKey` returning `null` means the
peer marks nothing.

Call `publishLocal()` after the local key changes; an unchanged key is not
sent again. The local peer never appears in the marks, since `room.peers`
excludes it. `dispose()` unsubscribes and publishes an empty map.

## `markedPeers` and `peerMarks`

```ts
const cursors = markedPeers(room, channel.values);
const marks = peerMarks(
  cursors.map(([peer, cursor]): MarkedPeer<string> => [peer, cursor.clip])
);
```

`markedPeers(room, values)` pairs each presence value with its sender's
`PresencePeer`, sorted by `clientId`, and skips `null` values and senders that
are not in `room.peers`. `peerMarks(marked)` folds such pairs into a
`PeerMarkMap<TKey>`, keeping their order in each bucket. `PeerMarkTracker`
publishes `peerMarks(markedPeers(room, values))`; use them directly when a
presence value carries more than a key.

## `peerBadges`

```ts
const node = {
  ...layerNode,
  badges: peerBadges(layerNode.id, marks)
};
```

Turns the peers marking `key` in a `PeerMarkMap<TKey>` into `jolly-tree`
badges (`color` and `title` from each peer's color and display name), at most
three, in bucket order. An unmarked key returns an empty array.
