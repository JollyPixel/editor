# Asset server architecture

The event store is the backend's history. The catalog, physical projection,
and live state are separate views of that history.

## Read by task

- [Startup and ownership](./architecture/Startup.md): assembly order, files,
  injected resources, and shutdown.
- [Events and projections](./architecture/EventsAndProjections.md): which
  events change the catalog, source, and live state.
- [Rooms and reconciliation](./architecture/RoomsAndReconciliation.md): edits
  from clients and changes made directly to physical storage.

## Workspace map

```mermaid
flowchart TB
    Editor["Editor clients"]
    Tool["External tools"]
    Files[("Physical asset storage")]

    subgraph Backend["Asset backend"]
        CatalogRoom["Catalog room"]
        AssetRoom["Asset room"]
        Writer["AssetWriter"]
        Store[("Event store")]
        Catalog["CatalogProjection<br/>ID · kind · path · revision"]
        Projector["AssetProjector<br/>path · serialized content"]
        State["AssetStateStore<br/>live in-memory state"]
        Scheduler["SnapshotScheduler"]
        Reconciler["Reconciler"]

        CatalogRoom -->|"create · rename · delete"| Writer
        AssetRoom -->|"domain event"| Store
        Writer -->|"lifecycle event"| Store

        Store -->|"lifecycle events"| Projector
        Projector -->|"desired state"| Catalog
        Store -->|"replay and new events"| State

        Catalog -->|"snapshot and changes"| CatalogRoom
        Catalog -.->|"room admission and deletion"| AssetRoom
        State -->|"state snapshot and arbitration"| AssetRoom

        Store -.->|"domain event"| Scheduler
        State -.->|"serialize"| Scheduler
        Scheduler -->|"asset.updated"| Writer

        Projector -.->|"last written state"| Reconciler
        Reconciler -->|"detected lifecycle change"| Writer
    end

    Editor <--> CatalogRoom
    Editor <--> AssetRoom
    Projector -->|"write · move · delete"| Files
    Tool -->|"edit outside the backend"| Files
    Files -->|"scan"| Reconciler
```

The three views answer different questions:

| View | What it answers | Lifetime |
|---|---|---|
| Catalog | Which assets exist, and where are they? | Rebuilt when the backend starts, then kept current. |
| Physical projection | What path and bytes should storage contain? | Rebuilt when the backend starts, then kept in sync with the asset source. |
| Live state | What is the editable state of this open asset? | Replayed when its room opens and released after eviction. |

## Source layout

Each folder under `src/` imports only from the folders listed above it:

- `common/`: helpers with no asset vocabulary (`TaskChain`, `contentHash`,
  `Logger`).
- `model/`: asset kinds, their handlers, and the asset event types.
- `storage/`: the physical projection. `AssetWriter`, `AssetProjector`,
  `Reconciler`, and the files in the state directory.
- `catalog/`: `CatalogProjection`, the catalog room, tags, archives, and the
  browser client served as `./client`.
- `live/`: asset rooms, `AssetStateStore`, and `SnapshotScheduler`.
- `server/`: the `./node` entry. `AssetServer`, the HTTP catalog handler,
  Vite plugins, and the project file.

`createAssetBackend.ts` at the root wires these together.

## Live state lifetime

```mermaid
stateDiagram-v2
    [*] --> Replaying: first client joins
    Replaying --> Open: checkpoint + later events folded
    Open --> Open: domain events folded
    Open --> Grace: last client leaves
    Grace --> Open: client rejoins
    Grace --> Evicted: grace period expires
    Evicted --> [*]: flush pending snapshot and release state
```

## A room edit reaches storage

```mermaid
sequenceDiagram
    participant Client
    participant Room as Asset room
    participant Store as Event store
    participant State as Live state
    participant Scheduler as Snapshot scheduler
    participant Writer as AssetWriter
    participant Catalog
    participant Projector as AssetProjector
    participant Files as Physical storage

    Client->>Room: editing command
    Room->>Store: append domain event
    Store->>State: fold command
    Store->>Scheduler: schedule snapshot
    Room-->>Client: broadcast accepted command

    Note over Scheduler: quiet period or explicit flush
    Scheduler->>State: serialize
    Scheduler->>Writer: update with serialized bytes
    Writer->>Store: append asset.updated
    Store->>Projector: fold lifecycle event
    Projector->>Catalog: refresh revision
    Projector->>Files: write content
```

The room snapshot sent on join and the persisted snapshot serve different
paths. Only the persisted `asset.updated` event is a replay checkpoint.

## An external file change enters history

```mermaid
sequenceDiagram
    participant Tool as External tool
    participant Files as Physical storage
    participant Reconciler
    participant Projector as AssetProjector
    participant Writer as AssetWriter
    participant Store as Event store
    participant Catalog
    participant State as Live state

    Tool->>Files: edit, move, create, or delete
    Reconciler->>Files: scan path and content hashes
    Reconciler->>Projector: compare with last written state
    Reconciler->>Writer: record detected change
    Writer->>Store: append lifecycle event
    Store->>Projector: fold lifecycle event
    Projector->>Catalog: update record
    Store->>State: load or clear if open
    Writer->>Projector: mark already projected

    Note over Projector,Files: no echo write to storage
```
