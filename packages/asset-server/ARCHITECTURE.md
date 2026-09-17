# Asset server architecture

The event store is the backend's history. The catalog, physical projection,
and live state are separate views of that history.

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

        Store -->|"lifecycle events"| Catalog
        Store -->|"lifecycle events"| Projector
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
    Store->>Catalog: refresh revision
    Store->>Projector: fold lifecycle event
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
    Store->>Catalog: update record
    Store->>State: load or clear if open
    Writer->>Projector: mark already projected

    Note over Projector,Files: no echo write to storage
```

Details: [asset kinds](./docs/AssetKinds.md), [rooms](./docs/Rooms.md), and
[synchronization](./docs/Sync.md).
