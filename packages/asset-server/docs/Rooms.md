# Rooms

`registerAssetRooms` installs a `network` room resolver that creates one room
for each open asset.

```ts
const clearResolver = registerAssetRooms({
  server,
  kinds,
  catalog,
  states,
  projector,
  scheduler,
  graceMs: 30_000
});
```

Most hosts call `backend.attach(server)`, which also registers the catalog
room. The returned callback clears the resolver. It does not evict rooms that
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
- the kind is registered and provides `createExtension`;
- the catalog contains the asset under that kind;
- the created extension uses the requested room name as its `id`.

The handler receives the live state through `AssetRoomBinding`:

```ts
interface AssetRoomBinding<TState> {
  readonly assetId: string;
  readonly kind: string;
  readonly roomId: string;
  readonly state: TState;
}
```

## Eviction

The server keeps an empty dynamic room for its configured grace period. A new
join during that period reuses the room. When the period expires, asset-server
snapshots pending state, writes it to the source and releases the live state
before the extension is disposed.

`graceMs` overrides the server default for asset rooms. Use
`server.settled(roomName)` to wait for asynchronous eviction. Closing the
server evicts all resolved rooms through the same path.

Rights use the extension's `name`, which asset handlers normally set to the
asset kind. This gives every room of one kind the same rights scope.
