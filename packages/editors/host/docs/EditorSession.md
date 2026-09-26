# EditorSession

The editor's connection to the asset server. It holds the target's room and
keeps one synced document per dependency, following the catalog as edges come and
go. [`mountStandalone`](./mountStandalone.md) opens it and passes it to
`mount` as `context.session`.

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
readonly target: AssetRoomLease;
readonly targetReady: Promise<void>;
readonly archive: SessionArchive;
readonly workspace: SessionWorkspace | null;
```

`target` exposes the target's `record` and `room`. Its shape depends on the
editor: register a document kind for `accepts` in `kinds` and the session opens
the target as a document lease, joining its room and building its document like
any dependency. Leave it out and the target stays room-only, with no document
and an unjoined room the editor wires itself.

`targetReady` settles when the target document has its first snapshot, and
resolves immediately for a room-only target. `connect()` already awaits it, so
by the time an editor mounts, a leased target is loaded.

`EditorSession.open()` waits up to five seconds for the network catalog
snapshot, then throws `CatalogUnavailableError` (from
`@jolly-pixel/asset-server/client`) and destroys its client.
`EditorSession.connect()` accepts `catalogTimeoutMs` for supplied clients;
without it, the caller owns connection liveness.

A page that needs the catalog without a session calls
`openCatalog(client, timeoutMs?)` instead. It resolves once the snapshot
lands. It wraps `CatalogClient.connect`: on failure or timeout it also
destroys the client and rethrows (`CatalogUnavailableError` on timeout). `CATALOG_TIMEOUT_MS` is the
five-second timeout `open()` uses.

`targetLease(kind)` returns that same document as a typed, refcounted
[`AssetLease`](./AssetLeases.md). It adds a holder, so release it when the
editor is disposed:

```ts
const target = session.targetLease(VOXEL_MAP_KIND_OBJECT);

paint(target.document);
// later
target.release();
```

Because the snapshot lands before `mount()`, an editor cannot learn the target's
contents from a one-off event. Read the current state when attaching, and treat
later events as updates.

`identity` contains `username`, `peerId`, and `color`. The username prompt
remembers the entered username per tab. `assets` is the session's
[`AssetLeases`](./AssetLeases.md), where panels open their own leases.
`catalog` comes from `@jolly-pixel/asset-server/client`.

## Identity

The username prompt stores the entered name in `sessionStorage` under
`IDENTITY_STORAGE_KEY` (`"jolly-pixel:username"`) and skips itself while a name
is stored.

```ts
function rememberQueryUsername(search?: string): void;
```

Stores the `username` query parameter under that key, so the prompt does not
open. `search` defaults to `location.search`; nothing happens without the
parameter. `mountStandalone` calls it when `dev` is set; a page that prompts on
its own calls it behind `import.meta.env.DEV`.

## Archives

`archive` exports and imports `.zip`
[asset archives](../../../asset-server/docs/Archive.md) through the catalog
room, the same way offline and on a server. The adapter is
`CatalogSessionArchive`, built over the `CatalogClient` archive methods;
`EditorSession` passes it the workspace's import capability.

```ts
const blob = await session.archive.export(session.target.record.id);

const plan = await session.archive.plan(file);
const report = await session.archive.import(file, {
  onConflict: plan.live.length > 0 ? "replace" : "keep"
});
```

| Member | Role |
|---|---|
| `canImport` | `false` on a workspace that does not persist, where an import would be lost by the reload that follows it |
| `export(assetId?)` | the asset with everything it references, or the whole workspace |
| `plan(file)` | the `ImportPlan`: which ids are `live` or `fresh`, incompatible kinds, and the `sharedDependents` a replace would affect; writes nothing |
| `import(file, { onConflict })` | the `ImportReport`; rejects with `ArchiveImportDisabledError` when `canImport` is `false` |

Ask for `onConflict` only when `plan.live` is not empty. An editor cannot
remount in place: after an import, reload onto `?target=<report.root.id>`.
`"copy"` duplicates the whole archive under new IDs and returns the new root.

`workspace` is `null` on a server session. On an
[offline workspace](./mountStandalone.md#offline) it tells whether the storage
is `persistent` and offers `reset()`, which closes the workspace and deletes
what the browser stored.
Shared follower tabs set `canReset` to `false`; reset from the owner tab.

### EditorArchives

`EditorArchives` wraps `archive` and `workspace` for an editor's export,
import and reset buttons; each button calls one flow.

```ts
archives(options: EditorSessionArchivesOptions): EditorArchives;
```

`session.archives()` builds one for the session's target and `accepts` kind;
the editor gives only the `fallbackName`, the `resetWarning` and, optionally,
the `browser`. The target is read from the catalog on each call, so a
renamed target downloads under its new path.

```ts
const archives = session.archives({
  fallbackName: "model",
  resetWarning: "Every model stored here is deleted."
});

await archives.download();
await archives.importFile(file);
await archives.reset();
```

| Member | Role |
|---|---|
| `canImport` / `canReset` / `volatile` | whether to offer import and reset, and whether edits are lost on reload |
| `download()` | exports the target and saves it as the target path's stem with `.zip`, or `fallbackName` |
| `importFile(file)` | rejects with `ArchiveRootError` before anything is written when the archive root is not an `accepts` asset; asks how to handle assets that already exist, imports, remembers the root as the last opened asset, then reloads onto it; does nothing when the question is dismissed |
| `reset()` | asks to confirm `resetWarning`, resets the workspace and reloads |

Downloads, dialogs and navigation go through the `browser` option, an
`EditorArchiveBrowser`; it defaults to the DOM and `window.location`.

### ArchiveActions

`<jolly-archive-actions>` renders the export, import and reset buttons of an
`EditorArchives`, the notice of a volatile workspace, and the error of the last
failed flow. It renders nothing until `archives` is set. Importing
`@jolly-pixel/editor.host/ui` defines it; the root entry point does not.

```ts
import "@jolly-pixel/editor.host/ui";

html`<jolly-archive-actions .archives=${archives}></jolly-archive-actions>`;
```

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

A dependency is an asset of the target's closure whose kind appears in the
editor's `kinds`. Assets of other kinds are not leased. Before `mount` starts,
the session waits for a snapshot of its dependencies to become ready. Leases
added while that snapshot is syncing may still be pending. Await each lease's
`ready` before using its document, then check that `session.dependency(id)` still
returns that lease.

Dependencies are frozen views owned by the session and have no `release()`
method. Lookup, iteration, and events share the same view until the dependency
is removed. Acquire a separate lease through `assets.open` when a panel needs
to keep the document alive independently.

`document` is typed `unknown` here. Checking `lease.record.kind` does not narrow
the document's TypeScript type. Use a document type guard, or open a typed lease with
`session.assets.open(kind, assetId)` and release it when finished. Reuse the
same kind object registered in the editor's `kinds`.

## Events

| Event | Payload | When |
|---|---|---|
| `dependency-added` | `AssetDependency` | the catalog gained an edge to a supported asset; the document may still be syncing, await `ready` |
| `dependency-removed` | `{ id, kind }` | the edge was removed or the record deleted; the session's lease is already released |

```ts
session.on("dependency-added", async(lease) => {
  try {
    await lease.ready;
    if (session.dependency(lease.record.id) === lease) {
      addTexture(lease.record.id, lease.document);
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

Dependency updates commit before events are emitted. If a document factory throws,
new acquisitions are released and the previous dependency set is retained.
Disposing the session from an event listener stops subsequent notifications.

## Disposal

```ts
dispose(): void;
```

Closes every lease, including those opened by panels through `assets`, then
the catalog and the network client. A second call does nothing.
