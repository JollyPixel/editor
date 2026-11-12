# Room adapters

Adapters over a `@jolly-pixel/network` room, from `@jolly-pixel/ui/network`.

- `@jolly-pixel/network` is an optional peer dependency. The subpath imports
  its `./client` entry, which keeps the server and `ws` out of browser bundles.
- Peers are keyed by connection: two tabs of one account are two peers.
- Every adapter builds peers with
  [`toPresencePeer`](./peer/identity.md#profile-helpers) and leaves out a
  remote peer whose profile sets `observer: true`.
- The local peer is keyed by `room.clientId` (`""` until admitted) and read
  from `room.profile`.

## `PeerRoster`

Pushes the room's peers through a `publish` callback, so the editor decides
where the list lives.

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
  `clientId`.
- Republishes on `sync`, `peer-joined`, `peer-left` and `peer-profile`,
  and on `peer-presence` only when a remote peer's activity label changed.
- With `log`, pushes a "has joined" or "has left" entry per remote peer.
  Peers already present at `sync`, and observers, are not announced.
- `dispose()` unsubscribes and publishes an empty list.

## `PeerMarkTracker`

Publishes one local key under `presenceKey` and folds every remote peer's key
into [`PeerMarks`](./peer/peer-marks.md).

```ts
interface PeerMarkTrackerOptions<TKey> {
  room: Room;
  presenceKey: string;
  decode: PresenceDecoder<TKey>;
  local: {
    read(): TKey | null;
    subscribe(listener: () => void): () => void;
  };
  publish: (marks: PeerMarks<TKey>) => void;
}

const tracker = new PeerMarkTracker<string>({
  room,
  presenceKey: "block",
  decode: decodeString,
  local: {
    read: () => selection.blockId,
    subscribe: (listener) => selection.subscribe("change", listener)
  },
  publish: (marks) => {
    store.blockSelections = marks;
  }
});
```

- `decode` is a function returning `undefined` for an unusable value, such as
  `decodeString` from `@jolly-pixel/network/client`, or a zod schema, as for a
  `PresenceChannel`. A peer whose value does not decode marks
  nothing.
- The tracker publishes `local.read()` on construction and on every `local`
  notification. A `null` key clears the local mark. An unchanged key is not
  sent again.
- Marks are ordered by `clientId`. The local peer never appears.
- Republishes when a peer's key changes, when a peer leaves, and on
  `peer-profile`, so a renamed peer's marks follow.
- `dispose()` unsubscribes and publishes empty marks.

## `markedPeers(room, values): PeerMark<TValue>[]`

Pairs each presence value with its sender, sorted by `clientId`. Skips `null`
values and senders not in the room. Use it with your own `PresenceChannel`
when a presence value carries more than a key:

```ts
const cursors = markedPeers(room, channel.values);
const focuses = new PeerMarks(
  cursors.map(([peer, cursor]) => [peer, cursor.clip])
);
```

## `RoomFieldLocks`

The [`FieldLockSource`](./peer/field-locks.md) of a room.

```ts
const fieldLocks = new RoomFieldLocks(room);
pane.fieldLocks = fieldLocks;
```

- Claims travel under the `fieldLock` presence key.
- `editors(path)` returns the same array until the room or a claim changes.
- `dispose()` detaches from the room.
