# EditorSession

The editor's connection to the asset server. It holds the target's room and
keeps one synced model per dependency, following the catalog as edges come and
go. [`mountStandalone`](./mountStandalone.md) opens it and passes it to
`mount` as `context.session`.

```ts
static async mount(context: EditorContext): Promise<MyEditor> {
  const { session } = context;

  const model = new MyTargetModel(session.target.room);
  session.target.room.join();

  for (const lease of session.dependencies()) {
    await lease.ready;
    if (session.dependency(lease.record.id) === lease) {
      addTexture(lease.record.id, lease.model);
    }
  }

  return new MyEditor(session, model);
}
```

## Properties

```ts
readonly identity: PeerIdentity;
readonly catalog: CatalogClient;
readonly assets: AssetLeases;
readonly target: AssetRoomLease;
```

`target` exposes the target's `record` and `room`. The room is not joined and
has no model: the editor attaches its own model, then joins.

`identity` contains `username`, `peerId`, and `color`. The username prompt
remembers the entered username per tab. `assets` is the session's
[`AssetLeases`](./AssetLeases.md), where panels open their own leases.
`catalog` comes from `@jolly-pixel/asset-server/catalog/client`.

## Dependencies

```ts
dependencies(): IterableIterator<AssetDependency>;
dependency(assetId: string): AssetDependency | undefined;

interface AssetDependency<TModel = unknown> {
  readonly record: AssetRecordData;
  readonly room: Room;
  readonly model: TModel;
  readonly ready: Promise<void>;
}
```

A dependency is an asset of the target's closure whose kind appears in the
editor's `kinds`. Assets of other kinds are not leased. Before `mount` starts,
the session waits for a snapshot of its dependencies to become ready. Leases
added while that snapshot is syncing may still be pending. Await each lease's
`ready` before using its model, then check that `session.dependency(id)` still
returns that lease.

Dependencies are frozen views owned by the session and have no `release()`
method. Lookup, iteration, and events share the same view until the dependency
is removed. Acquire a separate lease through `assets.open` when a panel needs
to keep the model alive independently.

`model` is typed `unknown` here. Checking `lease.record.kind` does not narrow
the model's TypeScript type. Use a model type guard, or open a typed lease with
`session.assets.open(kind, assetId)` and release it when finished. Reuse the
same kind object registered in the editor's `kinds`.

## Events

| Event | Payload | When |
|---|---|---|
| `dependency-added` | `AssetDependency` | the catalog gained an edge to a supported asset; the model may still be syncing, await `ready` |
| `dependency-removed` | `{ id, kind }` | the edge was removed or the record deleted; the session's lease is already released |

```ts
session.on("dependency-added", async(lease) => {
  try {
    await lease.ready;
    if (session.dependency(lease.record.id) === lease) {
      addTexture(lease.record.id, lease.model);
    }
  }
  catch (error) {
    console.error("Could not add dependency", lease.record.id, error);
  }
});
session.on("dependency-removed", ({ id }) => removeTexture(id));
```

The equality check skips a lease removed or replaced while syncing, including
leases cleared by session disposal. The error handler reports readiness
failures and errors from `addTexture`.

Dependency updates commit before events are emitted. If a model factory throws,
new acquisitions are released and the previous dependency set is retained.
Disposing the session from an event listener stops subsequent notifications.

## Disposal

```ts
dispose(): void;
```

Closes every lease, including those opened by panels through `assets`, then
the catalog and the network client. A second call does nothing.
