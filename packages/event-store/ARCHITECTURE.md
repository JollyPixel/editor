# Event store architecture

The event store keeps the history of every asset as a list of events. It
numbers and orders them, but never reads `eventData`. What an event means, and
how to rebuild an asset from its events, is up to the consumer.

## One log, many streams

```mermaid
flowchart TB
    subgraph A["Stream of asset A"]
        direction LR
        A1["v1 · id 1"] --> A2["v2 · id 3"] --> A3["v3 · id 4"]
    end
    subgraph B["Stream of asset B"]
        direction LR
        B1["v1 · id 2"] --> B2["v2 · id 5"]
    end
```

- Each asset has its own stream, numbered by `eventVersion` from 1.
- All streams share one log, ordered by `eventId`.
- Events are only appended. Neither number changes afterwards, even after
  compaction.

Code: `src/EventStore.ts`.

## Write, read, listen

```mermaid
flowchart TB
    Producer -->|"append"| Store["EventStore"]
    Consumer -->|"read history"| Store
    Store -->|"one write at a time"| Log[("Event log")]
    Store -.->|"new events"| Consumer
```

- Writes run one at a time, so two appends never race for the same version.
  Reads do not wait for them.
- A rejected append takes no position in the log.
- Listeners only hear new events: a consumer reads history first, then
  subscribes.

Code: `src/persistence/createEventStore.ts`.

## Checkpoints and compaction

```mermaid
flowchart TB
    subgraph Before["Before"]
        direction LR
        B1["v1"] --> B2["v2 · tagged"] --> B3["v3 · checkpoint"] --> B4["v4"]
    end
    subgraph After["After"]
        direction LR
        A2["v2 · tagged"] --> A3["v3 · checkpoint"] --> A4["v4"]
    end
    Before -->|"compact"| After
```

- A checkpoint carries an asset's whole state. The consumer names which event
  types are checkpoints, since only it knows how to rebuild the asset.
- `compact` deletes the events before each stream's newest checkpoint, except
  tagged ones. It cannot be undone.
- `listFromCheckpoints` reads the same cut without deleting anything.

Code: `src/persistence/memory/log.ts`, `src/persistence/sqlite/log.ts`.

## Backends

```mermaid
flowchart TB
    Store["EventStore"] --> Log["EventLog · internal"]
    Log --> Memory["Memory log"]
    Log --> SQLite["SQLite log · Node.js"]
    Memory -->|"writes through"| Journal["IndexedDB journal · browser"]
```

- Callers pick a factory from `persistence` and never see `EventLog`.
- The IndexedDB backend is a memory log loaded from the database. It writes to
  the journal before changing itself, so a failed write leaves it as it was.
- The main entry loads SQLite only when `persistence.sqlite()` is called.
  `@jolly-pixel/event-store/node` exports it directly.

Code: `src/persistence/`.

The [API](./docs/EventStore.md) covers options and errors, and the
[glossary](./GLOSSARY.md) defines the terms.
