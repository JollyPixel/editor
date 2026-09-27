# Runtime loading architecture

`AssetCoordinator` connects the persistent catalog to the objects that own
runtime loading state.

```mermaid
flowchart TB
    Reference["AssetReference"]
    Coordinator["AssetCoordinator"]

    subgraph Persistent["Persistent catalog"]
        direction TB
        Catalog["AssetCatalog"]
        Record["AssetRecord"]
        Catalog --> Record
    end

    subgraph RuntimeState["Runtime state"]
        direction TB
        Registry["AssetLoaderRegistry"]
        Loader["AssetLoader"]
        Handle["AssetHandle"]
        Batch["AssetLoadBatch"]
        Registry -->|"lookup by AssetType"| Loader
    end

    Reference --> Coordinator
    Coordinator -->|"resolve"| Persistent
    Record -->|"source"| RuntimeState
    Coordinator -->|"load() and loadBatch()"| Loader
    Coordinator -->|"request()"| Handle
    Batch -->|"shares in-flight work"| Coordinator
```

## Request and load

`AssetCoordinator.request()` resolves the reference against the catalog and
returns a handle. It records nothing and starts no I/O.

`load()` resolves the record, finds the loader registered with the reference's
`AssetType`, and runs it unless the asset is already loading or ready. `loadBatch()` applies the same work
to a snapshot of references.

Once an asynchronous boundary has completed, runtime-facing code uses a handle
or `AssetCoordinator.get()` for synchronous access.

## Value ownership

The coordinator owns values and in-flight promises for one runtime scope. Each
asset has one of four states:

```mermaid
stateDiagram-v2
    direction TB
    [*] --> unloaded
    unloaded --> loading: load() or batch
    loading --> ready: loader resolves
    loading --> failed: loader rejects
    failed --> loading: later load() starts a fresh attempt
    ready --> unloaded: evict()
```

Concurrent requests for the same asset ID and type receive the same loading
promise. After failure, a later `load()` or batch starts a fresh attempt.

`evict()` forgets one asset and returns its ready value. It neither aborts a
loader nor disposes a platform resource; the runtime that owns the resource
must handle disposal.

## Batch ownership

An `AssetLoadBatch` represents one operation, such as startup, a scene
transition, or dynamic content. The coordinator snapshots the input and
deduplicates repeated IDs within that batch.

```mermaid
sequenceDiagram
    participant Caller
    participant Coordinator as AssetCoordinator
    participant Batch as AssetLoadBatch

    Caller->>Coordinator: loadBatch(references)
    Note over Coordinator: snapshot input, deduplicate IDs,<br/>resolve every record
    Coordinator->>Batch: start tasks
    Coordinator-->>Caller: AssetLoadBatch
    Note over Batch: ready assets count as completed,<br/>with no progress callback
    Batch->>Coordinator: load pending asset
    Coordinator-->>Batch: settled
    Batch->>Caller: onProgress(completed, total)
    Note over Batch: waits for every task to settle
    Batch-->>Caller: done resolves, or rejects<br/>with AssetBatchLoadError
```

Overlapping batches keep separate totals, progress, status, and failures. They
still share in-flight work through the coordinator. Ready assets count toward the
initial completed value and do not produce progress callbacks.

The batch waits for every task to settle. Asset failures are collected in
`AssetBatchLoadError`. If the progress callback throws, `done` rejects with the
callback value after all tasks settle; that value is not added to the asset
failure list.

## Catalog changes

Catalog records and loaded values have separate lifetimes. Replacing or
removing an `AssetRecord` does not evict the value loaded from its previous
source. A runtime that applies catalog revisions should update the catalog,
call `AssetCoordinator.evict()`, dispose the returned value, and start the next load at its chosen
boundary.
