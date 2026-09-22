# Events and projections

The event store records lifecycle events (`asset.created`, `asset.updated`,
`asset.renamed`, `asset.deleted`) and kind-specific domain events. Each
consumer folds the events it needs.

```mermaid
flowchart TB
    Writer["AssetWriter"] --> Store[("Event store")]
    Room["Asset room"] --> Store
    Store --> Catalog["CatalogProjection"]
    Store --> Projector["AssetProjector"]
    Store --> State["AssetStateStore"]
    Projector --> Source[("AssetSource")]
    State --> Scheduler["SnapshotScheduler"]
    Scheduler --> Writer
```

## What each view holds

- **Catalog:** asset ID, kind, path, revision, and dependency edges. Lifecycle
  events change it; domain events do not.
- **Physical projection:** the path and content that `AssetSource` should
  contain. The projector follows lifecycle events and records its last
  processed position in `.jollypixel/state.json`.
- **Live state:** an editable kind's in-memory state. It is acquired when a
  room opens, rebuilt by replay, and released after room eviction.

`asset.created`, `asset.updated`, and `asset.deleted` are replay checkpoints.
The backend starts from the newest checkpoint for each asset. A rename is
folded after its preceding checkpoint.

## From edit to file

```mermaid
sequenceDiagram
    participant Client
    participant Room as Asset room
    participant Store as Event store
    participant State as Live state
    participant Scheduler as Snapshot scheduler
    participant Writer as AssetWriter
    participant Projector as AssetProjector
    participant Source as AssetSource
    Client->>Room: command
    Room->>Store: append domain event
    Store->>State: fold command
    Store->>Scheduler: schedule snapshot
    Room-->>Client: broadcast accepted command
    Scheduler->>State: serialize after quiet period
    Scheduler->>Writer: update bytes
    Writer->>Store: append asset.updated
    Store->>Projector: fold lifecycle event
    Projector->>Source: write bytes
```

The room's join snapshot gives a client current state. The later
`asset.updated` event persists serialized content and becomes a replay
checkpoint. `backend.flush(assetId?)` waits for pending snapshots and
projection writes.

See [Sync](../docs/Sync.md) for payloads and failure behavior.
