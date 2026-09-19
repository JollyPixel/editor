# AssetLeases

`AssetLeases` shares one room, and one synced model, per asset between every
holder.

## API

```ts
interface SyncedModel<TModel> {
  readonly model: TModel;
  readonly ready: Promise<void>;
  dispose(): void;
}

interface AssetModelKind<TModel, TCommand = any, TMessage = any> {
  readonly kind: string;
  createModel(room: Room<TCommand, TMessage>): SyncedModel<TModel>;
}

interface AssetRoomLease<TCommand = any, TMessage = any> {
  readonly record: AssetRecordData;
  readonly room: Room<TCommand, TMessage>;
  release(): void;
}

interface AssetLease<TModel, TCommand = any, TMessage = any>
  extends AssetRoomLease<TCommand, TMessage> {
  readonly model: TModel;
  readonly ready: Promise<void>;
}

class AssetLeases {
  constructor(options: {
    rooms: { room(name: string): Room; };
    records: { record(assetId: string): AssetRecordData | undefined; };
  });

  open<TModel, TCommand, TMessage>(
    kind: AssetModelKind<TModel, TCommand, TMessage>,
    assetId: string
  ): AssetLease<TModel, TCommand, TMessage>;
  openRoom<TCommand, TMessage>(
    kind: string,
    assetId: string
  ): AssetRoomLease<TCommand, TMessage>;
  has(assetId: string): boolean;
  holders(assetId: string): number;
  dispose(): void;
}
```

## Lifecycle

The first lease of an asset validates its record and opens its room. `open`
also builds the model and joins the room; `openRoom` leaves joining to the
holder. Later leases share the entry, and the last `release()` disposes the
model and leaves the room. A second `release()` of one lease does nothing.

`openRoom` can share an entry opened by `open`. `open` on an entry opened by
`openRoom` throws `AssetModelConflictError`.

A missing record throws `AssetNotFoundError`, and a record of another kind
throws `AssetKindMismatchError`. `dispose()` closes every entry whatever its
holder count.
