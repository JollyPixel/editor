# Event store glossary

This glossary defines the vocabulary for recording and ordering asset events.
Asset identity and classification come from the
[asset glossary](../asset/GLOSSARY.md). Rebuilding asset state and projecting
it to storage belong to the
[asset-server glossary](../asset-server/GLOSSARY.md).

## Terms

### Event

An immutable record accepted into an asset's history. An event names what
occurred, carries its domain data, identifies its actor, and records when the
store accepted it.

### Actor

The origin attributed to an event. A user actor carries a user identity. A
system actor names the process or service that produced the event.

### Event Stream

The ordered history of one asset. Events with the same
[asset ID](../asset/GLOSSARY.md#asset-id) form one stream.

### Append

The act of recording a new event at the end of an asset's stream and the
overall log. Appending extends history without revising earlier events.

### Event ID

An event's position in the overall log across all asset streams. Event IDs
express the order in which the store accepted events.

### Event Version

An event's position in one asset stream. Versions increase independently for
each asset and remain stable after compaction.

### Event Log

The ordered collection of recorded events across all asset streams. The log
grows through append operations and may shrink through compaction.

### Event Store

The boundary through which an application records and reads event history. It
owns the event log while leaving event meaning to its consumers.

### Checkpoint

An event from which a consumer can rebuild an asset without reading earlier
events. The consumer decides which event types qualify because it owns the
[fold](../asset-server/GLOSSARY.md#fold).

### Compaction

The irreversible removal of events that precede the newest checkpoint in each
asset stream. The checkpoint and every later event remain available.

## Naming boundaries

- Use **event ID** for position in the overall log and **event version** for
  position in one asset stream.
- Use **checkpoint** for the event that makes earlier history unnecessary and
  **compaction** for removing that history.
