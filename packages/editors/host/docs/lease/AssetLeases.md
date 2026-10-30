# AssetLeases

Shares one room and one synced document per asset between every holder. An
editor reaches it as [`session.assets`](../session/EditorSession.md#properties)
and never constructs it.

```ts
const lease = session.assets.open(pixelArtDocumentKind(), assetId);
await lease.ready;

paint(lease.document);

lease.release();
```

## Document kinds

```ts
type AssetDocumentKind<TDocument, TCommand = unknown, TMessage = unknown> =
  DocumentKind<string, Room<TCommand, TMessage>, SyncedDocument<TDocument>>;
```

A document kind pairs an asset kind with the factory of its synced document.
Asset packages export them, such as `pixelArtDocumentKind()` from
`@jolly-pixel/asset.pixel-art/client`.

Create each kind object once and reuse it, for the editor's `kinds` and for
every `open`. Opening one asset with two kind objects throws
`AssetDocumentConflictError`.

## open(kind, assetId, tag?): AssetLease

Builds the document and joins the room on the first lease of an asset. Later
leases share both. `tag` opens a tagged version as a separate entry, with its
own room and document.

## Leases

```ts
interface AssetRoomLease<TCommand = unknown, TMessage = unknown> {
  readonly record: AssetRecordData;
  readonly room: Room<TCommand, TMessage>;
  release(): void;
}

interface AssetLease<TDocument, TCommand = unknown, TMessage = unknown>
  extends AssetRoomLease<TCommand, TMessage> {
  readonly document: TDocument;
  readonly ready: Promise<void>;
}
```

- `ready` resolves once the document has its first snapshot.
- The last `release()` of an asset disposes its document and leaves its room.
  A second `release()` of one lease does nothing.
- A lease outlives a [switch](../boot/bootStandalone.md#switching-asset-or-tag):
  release what a panel opened in the editor's `dispose()`.
- On a server session, changes the server has not acknowledged survive a page
  reload and are sent by the next page that opens the asset. Tag views and
  offline data keep nothing.
