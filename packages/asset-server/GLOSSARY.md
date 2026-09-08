# Asset server glossary

This glossary defines the vocabulary for turning asset events into live state,
stored content, and catalog records. Asset identity comes from the
[asset glossary](../asset/GLOSSARY.md). Event storage and ordering come from
the [event-store glossary](../event-store/GLOSSARY.md).

## Terms

### Asset Backend

The service that connects event history with physical asset storage, the
catalog, and live editing rooms.

### Lifecycle Event

An event describing the creation, update, rename, or deletion of an asset.
Lifecycle events drive the catalog and the physical form of an asset.

### Domain Event

An event describing a change inside an asset, such as an editing operation.
Its meaning belongs to the asset kind that applies it.

### Asset Kind Handler

The domain policy for one asset kind. It creates live state, applies events to
that state, and turns the state back into asset content.

### Live State

The current in-memory state of an asset being used by the server. It is rebuilt
from event history and released when the asset no longer needs to stay open.

### Replay

Reading an asset's events in order to rebuild its live state or another
projection. Replay begins at the newest usable
[checkpoint](../event-store/GLOSSARY.md#checkpoint).

### Fold

The domain operation that applies lifecycle and domain events in order to
build state. Each asset kind owns its fold.

### Projection

A current representation derived from event history. Asset-server maintains
projections for physical asset storage and the asset catalog.

### Snapshot

A complete representation of an asset's live state, recorded as an update.
A later replay can use the snapshot as its checkpoint. Projecting the snapshot
brings physical storage up to date.

### Reconciliation

The comparison between physical asset storage and the latest projection.
External changes found during reconciliation become lifecycle events.

### Asset Room

The collaboration space for one open, editable asset. An asset room uses the
asset's live state and releases it after the room is evicted.

## Naming boundaries

- Use the [asset glossary](../asset/GLOSSARY.md) for **asset**, **asset ID**,
  **asset kind**, and **asset catalog**.
- Use the [event-store glossary](../event-store/GLOSSARY.md) for **event**,
  **actor**, **event stream**, and **checkpoint**.
- Use **lifecycle event** for changes to the asset itself and **domain event**
  for changes inside its kind-specific state.
- Use **replay** for reading history, **fold** for applying it, and
  **projection** for the resulting representation.
- Use **snapshot** for a complete state recorded into history and
  **reconciliation** for changes discovered in physical storage.
