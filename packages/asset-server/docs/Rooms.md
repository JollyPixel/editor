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
  flush: (assetId) => backend.flush(assetId),
  graceMs: 30_000
});
```

Most hosts call `backend.attach(server)`, which also registers the catalog
room and passes the backend's event store writer as `events`. The returned
callback clears the resolver. It does not evict rooms that
the server already resolved; `server.close()` disposes those rooms.

## Room names

```ts
new AssetRoom("pixelart", assetId).toString(); // "pixelart:<assetId>"
AssetRoom.parse("pixelart:a:1"); // kind "pixelart", assetId "a:1"
```

The first colon separates the kind from the asset ID. Empty kinds, empty IDs
and names without a colon are rejected. Import `AssetRoom` from
[`@jolly-pixel/asset`](../../asset/docs/api/domain/AssetRoom.md).

## Admission

A room is created when:

- the room name parses as `${kind}:${assetId}`;
- the kind is registered and provides `commands.live`;
- the catalog contains the asset under that kind.

Every asset room is hosted by `AssetRoomExtension`, which owns the
snapshot-on-connect (or catch-up on a resumed join), resync, and
arbitrate-append-broadcast plumbing; see
[asset kinds](./AssetKinds.md#writing-an-editable-kind). Kinds cannot
supply their own extension, so resolving a room never spawns a worker thread.

The handler receives the live state through `AssetRoomBinding`:

```ts
interface AssetRoomBinding<TState> {
  readonly assetId: string;
  readonly kind: string;
  readonly roomId: string;
  readonly state: TState;
  readonly version?: () => number | undefined;
}
```

`version` returns the room version, the `eventVersion` of the last event the
state store folded into `state`. `registerAssetRooms` sets it.

## Commands

The network server validates each message against the kind's
`commands.protocol` and drops one that does not match before the room sees
it. The room overwrites `clientId` with the sender's server-side id, lowers a
numeric `timestamp` ahead of the server clock to the server time, and
arbitrates the command through its live protocol. A client-supplied `clientId` is
never trusted. Conflicts are decided in server order: the event version, not
`timestamp`, is what the conflict tracker records.
An accepted command is appended to `events`, then committed with its event
version and broadcast as `{ type: "command", data, version }`.
The `network` server never touches the event store.

The author applied its command before sending it. When arbitration returns
`null`, or admits a narrowed command (a different object than it received),
the room sends the author alone a fresh `{ type: "snapshot", data, version, acks }`
so its state matches the room again. A kind whose live protocol implements
`correct` sends `{ type: "correction", data, acks }` instead, restoring only
what was refused. `acks` tells the author's `CommandSync` which of its
commands the room processed. When arbitration returned `null` (the command was
refused outright, not narrowed) or the append failed, the snapshot or correction also
carries `refused: <seq>`, so the author's `CommandSync` emits `"refused"` with
that command.
See [asset kinds](./AssetKinds.md#writing-an-editable-kind).

When the append fails, the room commits and broadcasts nothing and sends the
author alone the notice below, then a correction or a snapshot:

```ts
{ type: "rejected", reason: string }
```

`AssetRoomNotice` is the union of the `deleted` and `rejected` notices, for
the `TNotice` parameter of a client's `NetworkServerMessage`.

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
calls `flush(assetId)`, which snapshots pending state and writes it to the
source, then releases the live state before the extension is disposed.

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

## Replaced content

When the content of an open room's asset is replaced from outside the room,
such as a file edited on disk or an archive import, the room broadcasts a
fresh `snapshot` with the new version to every member. Clients load it as they
would a resync. Scheduled snapshots of the room's own edits do not trigger
it. See [Replay](./Sync.md#replay) for the `replaced` event behind it.

`AssetRoomExtension.reload()` sends that snapshot directly. It does nothing
once the asset is deleted or before any member has joined.

Rights use the extension's `name`, which asset handlers normally set to the
asset kind. This gives every room of one kind the same rights scope.
`AssetRoomExtension` names each event after the command's `action` when the
protocol declares it, and `invalid` otherwise.
