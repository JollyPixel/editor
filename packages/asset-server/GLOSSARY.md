# Asset server glossary

This glossary defines the vocabulary for turning asset events into live state,
stored content, and catalog records. Asset identity comes from the
[asset glossary](../asset/GLOSSARY.md). Event storage and ordering come from
the [event-store glossary](../event-store/GLOSSARY.md).

## Terms

### Asset Backend

The service that coordinates event history, physical asset storage, the asset
catalog, and live editing rooms.

### Lifecycle Event

An event that creates, updates, renames, or deletes an asset. Lifecycle events
drive the asset catalog and the asset's path and content in physical storage.

### Domain Event

An asset-kind-specific event describing a change inside an asset, such as an
editing operation. The asset kind defines how the event changes live state.

### Asset Kind Handler

The behavior registered for one asset kind. It creates, loads, and clears live
state, applies the kind's domain events, and serializes that state as asset
content.

### Live State

The current in-memory state of an open asset. It is rebuilt from event history
when an asset room opens and released after the room is evicted.

### Replay

Reading an asset's events in order to rebuild live state or a projection.
Replay begins at the newest usable
[checkpoint](../event-store/GLOSSARY.md#checkpoint).

### Fold

Applying an asset's events in order to build live state or a projection. The
backend handles lifecycle events, while each asset kind defines how its domain
events change live state.

### Projection

A current representation derived from event history. Asset-server derives the
asset catalog and the intended paths and content in physical storage as
projections.

### Snapshot

A complete representation of an asset's live state. Asset rooms send a
snapshot to each joining client. After domain events, the backend can also
record the serialized state as an update so later replay can use that event as
a checkpoint and physical storage can be brought up to date.

### Reconciliation

The comparison between physical asset storage and the state last projected
there. Differences made outside the backend become lifecycle events.

### Asset Room

The collaboration space for one open, editable asset. Accepted editing
commands become domain events. The room uses the asset's live state, which is
released after the room is evicted.

## Naming boundaries

- Use the [asset glossary](../asset/GLOSSARY.md) for **asset**, **asset ID**,
  **asset kind**, and **asset catalog**.
- Use the [event-store glossary](../event-store/GLOSSARY.md) for **event**,
  **actor**, **event stream**, and **checkpoint**.
- Use **lifecycle event** for changes to the asset itself and **domain event**
  for changes inside its kind-specific state.
- Use **replay** for reading history, **fold** for applying it, and
  **projection** for the resulting representation.
- Use **snapshot** for a complete state representation and **checkpoint** for
  a recorded event that lets replay skip earlier history.
- Use **reconciliation** for changes discovered in physical storage.
