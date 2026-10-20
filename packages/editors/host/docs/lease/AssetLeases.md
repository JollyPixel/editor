# AssetLeases

Shares one room, and one synced document, per asset between every holder. An
editor reaches it as [`session.assets`](../session/EditorSession.md#properties) and
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
  readonly pendingChanges: PendingChanges;
  dispose(): void;
}
```

`pendingChanges` is the network
[`PendingChanges`](../../../../network/docs/client/CommandSync.md#syncedcommanddocument)
of the document's sync client.

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
  assetId: string,
  tag?: string | null
): AssetLease<TDocument, TCommand, TMessage>;

openRoom<TCommand, TMessage>(
  kind: string,
  assetId: string,
  tag?: string | null
): AssetRoomLease<TCommand, TMessage>;
```

`open` builds the document and joins the room on the first lease of an asset.
`openRoom` opens the room only and leaves joining to the holder. Later leases
of the same asset share the room and the document.

The room is `kind:assetId`, or `kind@tag:assetId` when `tag` is set
(`null` by default). A tag lease and a current-version lease of one asset are
separate entries, each with its own room and document. The session opens its
target with the launch's tag, so `session.targetLease()` reads the
[tag view](../session/EditorToolbar.md#tag-views).

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
[lease lifecycle](../../ARCHITECTURE.md#lease-lifecycle).

One collection serves every session opened on a connection, including the
sessions of a [switch](../editor/mountStandalone.md#switching-target-or-tag), so a lease
opened by a panel outlives its session until released. Closing the connection
closes the collection permanently. Later `open` and `openRoom`
calls throw an error; releasing an existing lease afterward is harmless.

## Queries

```ts
has(assetId: string, tag?: string | null): boolean;
holders(assetId: string, tag?: string | null): number;
```

## Unsaved changes

```ts
readonly unsaved: boolean;
on(event: "unsaved", listener: (unsaved: boolean) => void): this;
settled(signal?: AbortSignal): Promise<void>;
```

`unsaved` is `true` while an open document has changes its server has not
acknowledged. The `unsaved` event fires each time it flips. Releasing the last
lease of such a document makes it `false` again. Its changes are lost, except
the [offline changes](#offline-changes) of a server session.
`settled()` resolves once `unsaved` is `false`, at once when it already is.
When `signal` aborts first, it rejects with `UnsettledChangesError`, whose
`cause` is the signal's reason.

## Offline changes

On a server session, each current-version document keeps its unacknowledged
changes in IndexedDB until the server answers them, through
[`pendingChanges.keepIn()`](../../../../network/docs/client/CommandSync.md#keepin-outbox-void).
A page that closes or reloads with changes still pending leaves them there.
The next page claims them when its session opens; when it opens the same
asset, it replays them over its first snapshot and sends them. Releasing and
reopening an asset in the same page picks up its changes the same way.

- A page never takes the changes of another page that is still open.
- Tag views and every offline backend (in-page, shared-tab, peer) keep nothing.
- A change the server applied but whose answer was lost with the page is
  skipped, as long as the server still remembers the closed page's client.
  After a server restart it is sent again.

## Errors

### AssetNotFoundError and AssetKindMismatchError

From `@jolly-pixel/asset`. The catalog has no record for `assetId`, or the
record has another kind.

### AssetDocumentConflictError

`open` targets an asset first opened with `openRoom`, or with another kind
object.
