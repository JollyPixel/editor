# Rooms

`registerAssetRooms` installs a `network` room resolver that creates one room
for each open asset.

```ts
const clearResolver = registerAssetRooms({
  server,
  events: eventStore.writer,
  kinds,
  catalog,
  states,
  projector,
  scheduler,
  graceMs: 30_000
});
```

Most hosts call `backend.attach(server)`, which also registers the catalog
room and passes the backend's event store writer as `events`. The returned
callback clears the resolver. It does not evict rooms that
the server already resolved; `server.close()` disposes those rooms.

## Room names

```ts
assetRoomName("pixelart", assetId); // "pixelart:<assetId>"
parseAssetRoomName("pixelart:a:1"); // { kind: "pixelart", assetId: "a:1" }
```

The first colon separates the kind from the asset ID. Empty kinds, empty IDs
and names without a colon are rejected.

## Admission

A room is created when:

- the room name parses as `${kind}:${assetId}`;
- the kind is registered and provides `commands.live`;
- the catalog contains the asset under that kind.

Every asset room is hosted by `AssetRoomExtension`, which owns the
snapshot-on-connect and arbitrate-append-broadcast plumbing. Kinds cannot
supply their own extension, so resolving a room never spawns a worker thread.

The handler receives the live state through `AssetRoomBinding`:

```ts
interface AssetRoomBinding<TState> {
  readonly assetId: string;
  readonly kind: string;
  readonly roomId: string;
  readonly state: TState;
}
```

## Commands

A room parses each message with the kind's `commands.parse` and arbitrates it
through its live protocol.
An accepted command is appended to `events`, then committed and broadcast.
The `network` server never touches the event store.

When the append fails, the room commits and broadcasts nothing and sends the
author alone:

```ts
{ type: "rejected", reason: string }
```

`ASSET_ROOM_REJECTED` holds the `"rejected"` type. Like the deleted notice, it
is added to the kind's outbound protocol and filtered under
`${kind}.rejected`.

## Actors

```ts
actorOf(identity: PeerIdentity): EventStore.Actor;
```

Returns `{ type: "user", id: identity.subject }`. Asset and catalog rooms stamp
every event with the actor of `context.identity`.

## Eviction

The server keeps an empty dynamic room for its configured grace period. A new
join during that period reuses the room. When the period expires, asset-server
snapshots pending state, writes it to the source and releases the live state
before the extension is disposed.

`graceMs` overrides the server default for asset rooms. Use
`server.settled(roomName)` to wait for asynchronous eviction. Closing the
server evicts all resolved rooms through the same path.

## Deleted assets

When the catalog removes an asset whose room is still open, the room
broadcasts a final notice to its members:

```ts
{ type: "deleted" }
```

`ASSET_ROOM_DELETED` holds the `"deleted"` type, and
`AssetRoomExtension` adds it to the kind's outbound protocol, so a rights
table can filter it under `${kind}.deleted`. After the notice the room drops
every command, and a client joining during the grace period receives the
notice instead of a snapshot. The room itself is evicted as usual once its
members leave.

Rights use the extension's `name`, which asset handlers normally set to the
asset kind. This gives every room of one kind the same rights scope.
`AssetRoomExtension` names each event after the command's `action` when the
protocol declares it, and `invalid` otherwise.
