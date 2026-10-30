# Event store glossary

Assets are not saved as files that get overwritten. Every change is recorded as
an **event**, and an asset's current state is what you get by replaying its
events in order. The event store keeps those events; it does not know what
they mean.

Each term below describes the idea first. The *In code* line names where it
shows up in the API. The [architecture](./ARCHITECTURE.md) shows how the parts
fit together.

## History

### Event

One change to an asset: what happened, its data, who did it and when the store
accepted it. Events are only ever added at the end, never edited. The **actor**
is who did it: a user, or a system process such as a server task.

*In code:* `Event`, with `eventType`, `eventData`, `actor` and `createdAt`.
`writer.append` adds one.

### Event stream

The history of one asset, numbered by **event version**: 1, 2, 3 and so on.
All streams share one **event log**, which numbers every event with an
**event ID** in the order the store accepted it. Neither number changes once
given.

*In code:* `assetId`, `eventVersion`, `eventId`. `reader.list` reads one
stream, `reader.listAll` the whole log.

## Trimming history

### Checkpoint

An event that carries an asset's whole state, so the asset can be rebuilt from
it without the events before it. The store cannot tell which events qualify,
so the consumer names the checkpoint event types.

*In code:* `checkpointEventTypes`, `reader.listFromCheckpoints`.

### Compaction

Deleting the events before each asset's newest checkpoint to save space. It
cannot be undone. The checkpoint, everything after it and every tagged event
stay.

*In code:* `compact`.

### Tag

A name pinned on one event of an asset, like a release label. A tagged event
survives compaction until its last tag is deleted.

*In code:* `tags.create`, `tags.delete`.
