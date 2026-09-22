# Event store architecture

The event store records an ordered history for each asset. It assigns an ID
across the whole log and a version within each asset stream. Consumers decide
what events mean and how to rebuild state from them.

## Workspace map

```mermaid
flowchart TB
    Caller["Asset backend or other consumer"]
    Store["EventStore<br/>writer · reader · subscribe · compact"]
    Writer["EventStoreWriter"]
    Log["EventLog<br/>shared backend contract"]
    Memory["MemoryEventLog<br/>instance-owned arrays and maps"]
    SQLite["SqliteEventLog<br/>SQLite events table"]

    Caller -->|"append"| Writer
    Caller -->|"read · compact · close"| Store
    Store --> Writer
    Writer -->|"insert"| Log
    Store -->|"read · compact · close"| Log
    Log -->|"memory factory"| Memory
    Log -->|"SQLite factory"| SQLite
    Writer -->|"append or error notification"| Caller
```

`createEventStore` connects an `EventStoreWriter` and an `EventLog`. The writer
returns a `Result` for each append and emits `append` or `error`. `subscribe`
listens to accepted appends, optionally filtering by a literal event type
prefix. It does not replay earlier events; a consumer reads history to build
its initial view.

An optional schema map checks `eventType` and `eventData` when appending at the
TypeScript boundary. Reads still return `Event` with an `unknown` payload, so
consumers validate stored data before treating it as a typed domain event.

| Backend | Factory | Storage | Runtime |
|---|---|---|---|
| Memory | `persistence.memory()` | One store instance | Browser or Node.js |
| SQLite | `await persistence.sqlite(location?)` | SQLite connection, optionally backed by a file | Node.js |

The main entry loads the Node-only SQLite backend when its factory is called.
The separate `@jolly-pixel/event-store/sqlite` entry exposes the SQLite factory,
log, and schema directly.

## Appending an event

```mermaid
sequenceDiagram
    participant Caller
    participant Writer as EventStoreWriter
    participant Log as EventLog backend
    participant Subscriber as Subscriber

    Caller->>Writer: append(assetId, eventType, eventData, actor)
    Writer->>Log: insert(input)
    Log->>Log: serialize payload and actor as JSON
    alt insert succeeds
        Log->>Log: assign eventId and asset eventVersion
        Log-->>Writer: stored event
        Writer-->>Subscriber: accepted event, if prefix matches
        Writer-->>Caller: Result with stored event
    else serialization or insert fails
        Log-->>Writer: error
        Writer-->>Caller: error notification with original input
        Writer-->>Caller: Result with error
    end
```

`eventId` orders accepted events across all assets. `eventVersion` increases
within one asset stream. Each event also records `assetType`, `eventType`,
`eventData`, `actor`, and `createdAt`. Both backends store JSON values rather
than references to the caller's objects; a rejected append consumes neither
position. Subscriber callbacks run after the backend accepts an event.

## Reading history

```mermaid
flowchart LR
    Log[("Event log<br/>all asset streams")]
    One["list(assetId)<br/>one stream by eventVersion"]
    All["listAll()<br/>all streams by eventId"]
    OneCheckpoint["listFromCheckpoint(assetId, types)<br/>newest checkpoint onward"]
    Checkpoints["listFromCheckpoints(options)<br/>each stream's checkpoint onward"]

    Log --> One
    Log --> All
    Log --> OneCheckpoint
    Log --> Checkpoints
```

`list` can exclude versions at or below `fromVersion`. `listAll` can exclude
IDs at or below `fromEventId`, filter by event type prefix, and limit the
result. Checkpoint reads retain each stream's newest matching checkpoint and
every later event. A stream without a matching checkpoint remains whole. The
multi-stream form returns surviving events in global `eventId` order; its
prefix filter applies after the checkpoint boundary is chosen.

## Checkpoints and compaction

```mermaid
flowchart TB
    Before["One asset stream<br/>v1 · v2 · checkpoint v3 · v4 · checkpoint v5 · v6"]
    Read["Checkpoint read<br/>checkpoint v5 · v6"]
    Compact["compact(checkpointEventTypes)"]
    After["Stored stream<br/>checkpoint v5 · v6"]

    Before -->|"read without deletion"| Read
    Before --> Compact
    Compact -->|"remove earlier events"| After
```

The caller supplies checkpoint event types because only the consumer knows
which events can replace earlier state. `compact` permanently removes events
before the newest matching checkpoint in each asset stream. Streams without a
checkpoint stay intact. Surviving IDs and versions do not change, and the
report counts removed events and assets with checkpoints. SQLite can run
`VACUUM` after a deletion when `reclaim` is true; the memory backend has no
file to reclaim.

Details: [API and data model](./docs/EventStore.md),
[memory persistence](./docs/Memory.md), [SQLite persistence](./docs/Sqlite.md),
and [glossary](./GLOSSARY.md).
