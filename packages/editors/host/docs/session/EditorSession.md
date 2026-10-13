# EditorSession

The editor's view of one target on a [connection](#connection) to the asset
server. It holds the target's room and keeps one synced document per
dependency, following the catalog as edges come and go.
[`mountStandalone`](../editor/mountStandalone.md) opens it and passes it to `mount` as
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
readonly tag: string | null;
readonly target: AssetRoomLease;
readonly targetReady: Promise<void>;
readonly archive: SessionArchive;
readonly workspace: SessionWorkspace | null;
```

`identity`, `catalog`, `assets`, `archive` and `workspace` belong to the
[connection](#connection) and are shared by every session opened on it.

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

### archive and workspace

See [Archives](./Archives.md). `workspace` is `null` on a server session.

## Methods

### targetLease(kind)

The target document as a typed, refcounted [`AssetLease`](../lease/AssetLeases.md).
Release it when the editor is disposed.

```ts
const target = session.targetLease(VOXEL_MAP_KIND_OBJECT);

paint(target.document);
// later
target.release();
```

### archives(options)

Builds the [`EditorArchives`](./Archives.md#editorarchives) of the target.

### dispose()

Releases the session's target and dependency leases. Leases panels opened
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

Dependencies belong to the session and have no `release()`. A panel that
needs a document to outlive the dependency opens its own lease with
`session.assets.open(kind, assetId)`, using the same kind object as `kinds`.
That is also how to get a typed document: `document` is `unknown` here.

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

The username prompt stores the name in `sessionStorage` under
`IDENTITY_STORAGE_KEY` (`"jolly-pixel:username"`) and skips itself while one
is stored. `rememberQueryUsername(search?)` stores the `username` query
parameter there; `mountStandalone` calls it in [dev](../editor/mountStandalone.md#dev).

## Connection

```ts
class SessionConnection {
  static open(options: SessionConnectionOpenOptions): Promise<SessionConnection>;
  static connect(options: SessionConnectionConnectOptions): Promise<SessionConnection>;

  readonly identity: PeerIdentity;
  readonly catalog: CatalogClient;
  readonly assets: AssetLeases;
  readonly archive: SessionArchive;
  readonly workspace: SessionWorkspace | null;

  openSession(target: EditorSessionTarget): Promise<EditorSession>;
  dispose(): void;
}
```

A connection holds the network client, the catalog and one `AssetLeases`.
`mountStandalone` keeps one per page and opens a session on it for each
[switch](../editor/mountStandalone.md#switching-target-or-tag), so a dependency two
sessions use stays joined.

### open({ identity, shell?, openCatalog?, logger? })

Joins as `shell.identity`, or prompts for a username. Creates a network
client and waits `CATALOG_TIMEOUT_MS` (5 s) for the catalog snapshot, then
throws `CatalogUnavailableError` and destroys the client.

### connect({ identity, client, workspace?, catalogTimeoutMs?, openCatalog?, logger? })

Uses a supplied client. Without `catalogTimeoutMs`, the caller owns
connection liveness.

`openCatalog` lets both open the catalog somewhere other than the client's
catalog room, such as a [shell's catalog port](../launch/ShellChannel.md#catalog-port).
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

`open()`, `connect()` and `openSession()` log
[`Logger.step`](../../../../engine/docs/systems/logger.md#steps) entries to
their `logger` (`host.session` under `mountStandalone`):

- `identity`: the username prompt, `open()` only.
- `catalog`
- `target`, with `kind` and `id`.
- `dependency`, one per dependency, with `kind` and `id`.

`target` and `dependency` run concurrently, so a lease that never loads is the
one whose `started` line has no `done`.
