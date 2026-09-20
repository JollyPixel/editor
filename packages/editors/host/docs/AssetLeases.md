# AssetLeases

Shares one room, and one synced model, per asset between every holder. An
editor reaches it as [`session.assets`](./EditorSession.md#properties) and
never constructs it.

```ts
const lease = session.assets.open(pixelArtModelKind(), assetId);
await lease.ready;

paint(lease.model);

lease.release();
```

## Model kinds

```ts
interface AssetModelKind<TModel, TCommand = unknown, TMessage = unknown> {
  readonly kind: string;
  createModel(room: Room<TCommand, TMessage>): SyncedModel<TModel>;
}

interface SyncedModel<TModel> {
  readonly model: TModel;
  readonly ready: Promise<void>;
  dispose(): void;
}
```

A model kind pairs an asset kind with the factory of its synced model. Asset
packages export them, such as `pixelArtModelKind()` from
`@jolly-pixel/asset.pixel-art/network/client.ts`.

Create each kind object once and reuse it, for the editor's static `kinds` and
for every `open` call. Two kind objects for the same asset
[conflict](#errors).

## Opening

```ts
open<TModel, TCommand, TMessage>(
  kind: AssetModelKind<TModel, TCommand, TMessage>,
  assetId: string
): AssetLease<TModel, TCommand, TMessage>;

openRoom<TCommand, TMessage>(
  kind: string,
  assetId: string
): AssetRoomLease<TCommand, TMessage>;
```

`open` builds the model and joins the room on the first lease of an asset.
`openRoom` opens the room only and leaves joining to the holder. Later leases
of the same asset share the room and the model.

## Leases

```ts
interface AssetRoomLease<TCommand = unknown, TMessage = unknown> {
  readonly record: AssetRecordData;
  readonly room: Room<TCommand, TMessage>;
  release(): void;
}

interface AssetLease<TModel, TCommand = unknown, TMessage = unknown>
  extends AssetRoomLease<TCommand, TMessage> {
  readonly model: TModel;
  readonly ready: Promise<void>;
}
```

The last `release()` of an asset disposes its model and leaves its room. A
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
| `AssetModelConflictError` | this package | `open` targets an asset first opened with `openRoom`, or with another kind object |
