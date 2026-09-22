# Editor host glossary

This glossary defines the vocabulary for editor launch, mounting, and asset
session ownership in `@jolly-pixel/editor.host`.

## Terms

### Launch

The request to open an editor for one target asset. `EditorLaunch` carries the
target's asset ID.

### Launch source

A reader that supplies a launch from a host message, query string, or injected
page data. Sources are checked in order until one returns a launch.

### Target

The asset opened by the editor. The session holds a room lease for it; the
editor owns its document and synchronization.

### Editor definition

The contract an editor supplies to the host: its accepted asset kind, identity
prompt options, dependency document kinds, and `mount` method.

### Editor context

The launch and connected session passed to the editor's `mount` method.

### Mount

Start an editor for the selected asset. `mountStandalone` finds the target and
opens a session, then calls the editor's `mount(context)` method. That method
sets up the editor and returns a handle whose `dispose()` ends its session.

### Session

The owner of an editor's catalog connection, target room lease, and dependency
leases. It updates dependency leases as the catalog changes and releases its
resources on disposal.

### Asset room

The network room for one asset, where clients receive its current state and
editing updates. A target room is handed to the editor to join; the session
joins rooms for supported dependencies. See the
[asset-server glossary](../../asset-server/GLOSSARY.md#asset-room).

### Dependency

An asset referenced by the target, directly or through another dependency.
The session opens a document for it when the editor registered its asset
document kind.

### Asset lease

A consumer's reference to a shared asset room, optionally with a synced document.
Releasing the last lease disposes the document and leaves the room. A room-only
lease exposes the asset record and room without a document.

### Asset document kind

The registration that pairs an asset kind with a factory for its synced document.
The session uses these registrations to lease supported dependencies.

### Synced document

An asset's editable document together with the code that keeps it updated from its
room. The `SyncedDocument` wrapper exposes the `document`, a `ready` promise for the
initial sync, and `dispose()` to stop syncing. The session creates these for
supported dependencies; each editor creates its target document itself. Leases for
the same asset share one synced document.

### Archive

A ZIP file containing one asset and the assets it references, or every asset
in a workspace. It contains serialized asset content, not editing history.
`session.archive` can export one, check an import for conflicts with `plan`,
and import it when `canImport` is true. See the
[archive format](../../asset-server/docs/Archive.md).

### Workspace

The collection of assets available through a catalog. An `OfflineWorkspace`
runs the asset back-end in the page and stores that collection in memory or
IndexedDB. The optional `session.workspace` reports whether its storage
persists across reloads and provides `reset()`; it is `null` for a session
connected to the usual asset server.
