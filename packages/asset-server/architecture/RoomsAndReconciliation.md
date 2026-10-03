# Rooms and reconciliation

`backend.attach(server)` registers the `asset-catalog` room and a resolver
for editable assets. An asset room is admitted when its kind has
`commands.live` and the catalog contains that asset under the same kind.

## Room lifetime

```mermaid
stateDiagram-v2
    [*] --> Replaying: first join
    Replaying --> Open: state acquired
    Open --> Open: accepted command
    Open --> Grace: last client leaves
    Grace --> Open: client rejoins
    Grace --> Evicted: grace expires
    Evicted --> [*]: flush and release state
```

The room validates and arbitrates a command, appends it, then commits and
broadcasts it. The event store folds the command into live state. A failed
append sends `rejected` to the sender and leaves the room state unchanged.
The [Asset kinds guide](../docs/AssetKinds.md#writing-an-editable-kind)
defines the handler's side of this contract.

## Changes outside the backend

An external tool can edit files in `AssetSource`. `SourceWatcher` groups
notifications into batches. A batch holding a file change runs `Reconciler`,
which compares scanned paths and hashes with the last projected state; every
batch then refreshes `CatalogFolders`. `backend.reconcile()` runs the same
scan and refresh on demand.

```mermaid
flowchart TB
    Tool["External tool"] --> Source[("AssetSource")]
    Source --> Watcher["SourceWatcher"]
    Watcher -->|"file batch"| Reconciler["Reconciler"]
    Watcher -->|"every batch"| Folders["CatalogFolders"]
    Reconciler --> Writer["AssetWriter"]
    Writer --> Store[("Event store")]
    Store --> Projector["AssetProjector"]
    Projector --> Catalog["CatalogProjection"]
    Store --> State["Open live state"]
```

The reconciler records detected creates, updates, renames, and deletions as
system lifecycle events. Unique matching content hashes identify renames;
ambiguous matches become a deletion and creation. A write already present
in the source is marked projected, so it is not written back as an echo.

See [Rooms](../docs/Rooms.md) for room messages and eviction, and
[Sync](../docs/Sync.md#reconciliation) for scan results.
