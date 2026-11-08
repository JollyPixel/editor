# `PeerMarks`

Which peers mark which key: the layer a peer selected, the block it hovers,
the clip it plays. Each peer marks at most one key. A `PeerMarks` is
immutable; every change builds a new one.

```ts
import { PeerMarks } from "@jolly-pixel/ui";

const marks = new PeerMarks<string>([
  [ada, "layer-1"],
  [lin, "layer-1"],
  [sam, "layer-2"]
]);

marks.peersAt("layer-1"); // [ada, lin]
```

[`PeerMarkTracker`](../network.md#peermarktracker) publishes one from a room.

```ts
type PeerMark<TKey> = readonly [peer: PresencePeer, key: TKey];
```

- The constructor keeps the order it is given, and the first mark of a peer
  given twice.
- Iterating yields every `PeerMark` in that order. `size` counts the peers.

## Reading

### `peersAt(key): readonly PresencePeer[]`

The peers marking `key`, or an empty list.

### `markedBy(clientId): TKey | undefined`

The key a peer marks, or `undefined`.

### `keys(): IterableIterator<TKey>`

The keys at least one peer marks.

### `badges(key): TreeBadge[]`

The peers marking `key` as [`jolly-tree` badges](../data/tree.md#row-content):
at most three, coloured and titled per peer.

```ts
const node = {
  ...layerNode,
  badges: marks.badges(layerNode.id)
};
```

### `equals(other): boolean`

Whether both hold the same peers on the same keys. Peers compare by value, so
marks rebuilt from fresh peer objects are equal, and a renamed peer is not.

## Deriving

### `filter(predicate): PeerMarks<TKey>`

The marks whose key passes `predicate`.

### `prepend(peer, key): PeerMarks<TKey>`

A copy where `peer` marks `key`, first among that key's peers, in place of
any mark it held. Use it to show the local peer, which a tracker leaves out.

[`PeerMarkSync`](./peer-mark-sync.md) draws successive marks on a view.
