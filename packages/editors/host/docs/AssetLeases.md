# AssetLeases

Shares one room, and one synced document, per asset between every holder. An
editor reaches it as [`session.assets`](./EditorSession.md#properties) and
never constructs it.

```ts
const lease = session.assets.open(pixelArtDocumentKind(), assetId);
await lease.ready;

paint(lease.document);

lease.release();
```

## Document kinds

```ts
interface AssetDocumentKind<TDocument, TCommand = unknown, TMessage = unknown> {
  readonly kind: string;
  createDocument(room: Room<TCommand, TMessage>): SyncedDocument<TDocument>;
}

interface SyncedDocument<TDocument> {
  readonly document: TDocument;
  readonly ready: Promise<void>;
  dispose(): void;
}
```

A document kind pairs an asset kind with the factory of its synced document. Asset
packages export them, such as `pixelArtDocumentKind()` from
`@jolly-pixel/asset.pixel-art/client`.

Create each kind object once and reuse it, for the editor's static `kinds` and
for every `open` call. Two kind objects for the same asset
[conflict](#errors).

## Opening

```ts
open<TDocument, TCommand, TMessage>(
  kind: AssetDocumentKind<TDocument, TCommand, TMessage>,
  assetId: string
): AssetLease<TDocument, TCommand, TMessage>;

openRoom<TCommand, TMessage>(
  kind: string,
  assetId: string
): AssetRoomLease<TCommand, TMessage>;
```

`open` builds the document and joins the room on the first lease of an asset.
`openRoom` opens the room only and leaves joining to the holder. Later leases
of the same asset share the room and the document.

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

The last `release()` of an asset disposes its document and leaves its room. A
second `release()` of one lease does nothing. See the
[lease lifecycle](../ARCHITECTURE.md#lease-lifecycle).

Session disposal closes the collection permanently. Later `open` and `openRoom`
calls throw an error; releasing an existing lease afterward is harmless.

## Queries

```ts
has(assetId: string): boolean;
holders(assetId: string): number;
```

## Errors

| Error | From | Thrown when |
|---|---|---|
| `AssetNotFoundError` | `@jolly-pixel/asset` | the catalog has no record for `assetId` |
| `AssetKindMismatchError` | `@jolly-pixel/asset` | the record has another kind |
| `AssetDocumentConflictError` | this package | `open` targets an asset first opened with `openRoom`, or with another kind object |
