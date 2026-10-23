# EditorSession

The editor's view of one target on a [connection](#connection) to the asset
server. It holds the target's room and keeps one synced document per
dependency, following the catalog as edges come and go.
[`mountStandalone`](../boot/mountStandalone.md) opens it and passes it to `mount` as
`context.session`.

```ts
static async mount(context: EditorContext): Promise<MyEditor> {
  const { session } = context;

  const document = new MyTargetDocument(session.target.room);
  session.target.room.join();

  for (const lease of session.dependencies()) {
    await lease.ready;
    if (session.dependency(lease.record.id) === lease) {
      addTexture(lease.record.id, lease.document);
    }
  }

  return new MyEditor(session, document);
}
```

## Properties

```ts
readonly identity: PeerIdentity;
readonly catalog: CatalogClient;
readonly assets: AssetLeases;
readonly connectionStatus: ConnectionStatus | null;
readonly tag: string | null;
readonly target: AssetRoomLease;
readonly targetReady: Promise<void>;
readonly archive: SessionArchive;
readonly offline: OfflineMode | null;
```

`identity`, `catalog`, `assets`, `connectionStatus`, `archive` and `offline`
belong to the [connection](#connection) and are shared by every session opened
on it.

### target

The target's `record` and `room`. When `kinds` registers a document kind for
`accepts`, the target is leased like a dependency: room joined, document
built. Otherwise it stays room-only, with an unjoined room the editor wires
itself.

### targetReady

Settles once the target document has its first snapshot. `mount` runs after
it, so an editor reads the current state when attaching and treats later
events as updates.

### tag

The tag of the launch, `null` for the current version.

### assets

The connection's [`AssetLeases`](../lease/AssetLeases.md), where panels open their
own leases.

### connectionStatus

```ts
class ConnectionStatus extends Emitter<{ change: () => void; }> {
  readonly online: boolean;
  readonly unsaved: boolean;
}
```

Whether the server is reachable, `null` when the session is not on a server.
`online` starts as the client's `ready`, turns `false` when the client loses
its socket and `true` once it reconnects. `unsaved` mirrors `assets.unsaved`.
`change` fires when `online` flips, and when `unsaved` flips while offline.
The [toolbar](./EditorToolbar.md#properties) shows it.

### archive and offline

See [Archives](./Archives.md). `offline` is `null` on a server session.

### targetRecord

The target's current catalog record, which follows a rename or a move.
`target.record` keeps the record the session opened.

## Methods

### targetLease(kind)

The target document as a typed [`AssetLease`](../lease/AssetLeases.md),
sharing the document the session holds. Pass the same kind object as
`kinds`. The session releases it when disposed, so the editor does not.

```ts
const target = session.targetLease(VOXEL_MAP_KIND_OBJECT);

paint(target.document);
```

### lease(kind, assetId)

A typed lease on another asset, held until the session is disposed. Use it
for a document the editor needs for its whole mount, such as a model's
texture.

```ts
const texture = session.lease(PIXEL_ART_KIND_OBJECT, reference.id);
```

Both `targetLease` and `lease` throw once the session is disposed.

### dispose()

Releases the session's target, dependency and held leases. Leases opened
through `assets` stay open until released or until the connection is
disposed. `mountStandalone` owns the session; an editor's `dispose()` must not
call it.

## Dependencies

```ts
dependencies(): IterableIterator<AssetDependency>;
dependency(assetId: string): AssetDependency | undefined;

interface AssetDependency<TDocument = unknown> {
  readonly record: AssetRecordData;
  readonly room: Room;
  readonly document: TDocument;
  readonly ready: Promise<void>;
}
```

A dependency is an asset of the target's closure whose kind is in the
editor's `kinds`. A lease added while the first snapshot syncs may still be
pending: await its `ready`, then check that `session.dependency(id)` still
returns it.

Dependencies belong to the session and have no `release()`. For a typed
document that outlives the dependency, hold it with
[`lease(kind, assetId)`](#leasekind-assetid) for the whole mount, or open
it with `session.assets.open(kind, assetId)` and release it when the panel
is done. Use the same kind object as `kinds`: `document` is `unknown` here.

## Events

### dependency-added

Payload: `AssetDependency`. The catalog gained an edge to a supported asset.
The document may still be syncing.

### dependency-removed

Payload: `{ id, kind }`. The edge was removed or the record deleted. The
session's lease is already released.

```ts
session.on("dependency-added", async(lease) => {
  await lease.ready;
  if (session.dependency(lease.record.id) === lease) {
    addTexture(lease.record.id, lease.document);
  }
});
session.on("dependency-removed", ({ id }) => removeTexture(id));
```

The equality check skips a lease removed or replaced while syncing.

## Identity

The username prompt of `serverConnection()` stores the name in `sessionStorage` under
`IDENTITY_STORAGE_KEY` (`"jolly-pixel:username"`) and skips itself while one
is stored. `rememberQueryUsername(search?)` stores the `username` query
parameter there; `mountStandalone` calls it in [dev](../boot/mountStandalone.md#dev).

## Connection

```ts
class SessionConnection {
  static connect(options: SessionConnectionConnectOptions): Promise<SessionConnection>;

  readonly identity: PeerIdentity;
  readonly catalog: CatalogClient;
  readonly assets: AssetLeases;
  readonly connectionStatus: ConnectionStatus | null;
  readonly archive: SessionArchive;
  readonly offline: OfflineMode | null;

  openSession(target: EditorSessionTarget): Promise<EditorSession>;
  dispose(): void;
}
```

A connection holds the network client, the catalog and one `AssetLeases`.
`mountStandalone` keeps one per page and opens a session on it for each
[switch](../boot/mountStandalone.md#switching-target-or-tag), so a dependency two
sessions use stays joined.

### connect(options)

```ts
interface SessionConnectionConnectOptions extends StandaloneConnection {
  logger?: HostLogger;
}

interface StandaloneConnection {
  identity: PeerIdentity;
  client: EditorSessionClient;
  openCatalog?: CatalogOpener;
  offline?: OfflineMode;
  server?: ServerConnection;
  openOutboxes?: () => Promise<PendingOutboxes | null>;
}
```

Opens the catalog on `client` and builds the connection. Each way of
reaching assets supplies its own fields:

- `server` is the client's link to the asset server. With it, the catalog
  snapshot has `CATALOG_TIMEOUT_MS` (5 s) to arrive before
  `CatalogUnavailableError`, and the link feeds `connectionStatus`. Without
  it, the caller owns connection liveness.
- `openOutboxes` keeps [offline changes](../lease/AssetLeases.md#offline-changes)
  across page loads. Only the page's own server connection passes it.
- `offline` marks an [offline](../boot/bootStandalone.md#offline-mode) back-end.

A failed catalog destroys the client.

### serverConnection({ identity, shell, logger })

The connection to the page's asset server. It joins as `shell.identity`,
or prompts for a username, renews the session when the shell asks to, and
sets `server` and `openOutboxes`. A share link sets `server` but keeps no
outboxes.

`openCatalog` opens the catalog somewhere other than the client's
catalog room, such as a [shell's catalog port](../shell/ShellChannel.md#catalog-port).
A page that needs only the catalog calls
`openCatalog(client, timeoutMs?, open?)`, which destroys the client on
failure.

### openSession({ launch, accepts, kinds, logger? })

Leases the target, through its tag room when `launch.tag` is set, and its
dependencies, then resolves once they are ready. A target that cannot be
leased rejects and leaves the connection open.

### dispose()

Closes every lease left open, including the panels' ones, then the catalog
and the client.

### Boot steps

`serverConnection()`, `connect()` and `openSession()` log
[`Logger.step`](../../../../engine/docs/systems/logger.md#steps) entries to
their `logger` (`host.session` under `mountStandalone`):

- `identity`: the username prompt, `serverConnection()` only.
- `catalog`
- `target`, with `kind` and `id`.
- `dependency`, one per dependency, with `kind` and `id`.

`target` and `dependency` run concurrently, so a lease that never loads is the
one whose `started` line has no `done`.
