# Sync

The event log records asset lifecycle and domain events. The backend projects
those events to the asset source and catalog. Reconciliation converts external
source changes into lifecycle events.

## Lifecycle events

The `asset.` prefix is reserved for these events:

```ts
asset.created // { path, kind, hash, size, content }
asset.updated // { path, kind, hash, size, content }
asset.renamed // { from, to, kind, hash }
asset.deleted // { path, kind }
```

Create and update events store content as base64:

```ts
type AssetContent =
  | { type: "inline"; encoding: "base64"; data: string }
  | { type: "ref"; hash: string; size: number };
```

Only inline content is supported. `decodeContent()` throws when given a
reference. `encodeContent()`, `decodeContent()` and the event constants are
exported from the main package entrypoint.

### Typed payloads

`AssetEventDataMap` binds each event type to its payload, and `AssetEvent`
is a stored event narrowed to a matching pair:

```ts
type AssetEventDataMap = {
  "asset.created": AssetWriteData;
  "asset.updated": AssetWriteData;
  "asset.renamed": AssetRenamedData;
  "asset.deleted": AssetDeletedData;
};
```

`isAssetEvent(event)` validates a stored event against that map. Readers use
it instead of asserting a payload shape, because events come back from
persistence as parsed JSON.

An event whose payload does not match its type is skipped rather than folded:
the projector keeps the asset's last good projection and logs
`malformed asset event skipped`, and the catalog keeps its last good record
and returns `false` from `apply`. Neither aborts a replay, so one corrupt
row cannot stop the backend from starting.

## Snapshots

Domain events update the live state held by an asset kind handler. The
`SnapshotScheduler` serializes that state and appends `asset.updated` after the
configured quiet period, capped by the maximum delay. A snapshot is skipped
when the serialized bytes have the current content hash.

`backend.flush(assetId?)`, room eviction and backend shutdown flush pending
snapshots. See [Asset kinds](./AssetKinds.md#snapshot-policy) for cadence.

## Replay

```ts
states.acquire(assetId: string, kind: string): Promise<AssetStateEntry>
```

Snapshots double as replay checkpoints. `acquire` folds only from the newest
`asset.created`, `asset.updated` or `asset.deleted`, so replay cost tracks
edits since the last snapshot rather than the whole history. The fold yields
periodically, so a long stream cannot hold the event loop while other rooms
resolve, and concurrent callers share one replay.

## Reconciliation

```ts
reconciler.reconcile(): Promise<Result<ReconcileReport, Error>>

interface ReconcileReport {
  readonly created: number;
  readonly updated: number;
  readonly renamed: number;
  readonly deleted: number;
  readonly failed: number;
}
```

A successful result counts lifecycle events appended during the scan. An
unreadable entry increments `failed` without stopping other entries. Failure to
list the source returns an error result for the whole scan.

Renames are recognized when one removed path and one added path have the same
unique content hash. Ambiguous matches are recorded as deletion and creation.
Byte-identical changes append no event.

On a source with `watch()`, `ReconciliationWatcher` groups notifications using
the configured debounce. Its public controls are:

```ts
watcher.start(): void
watcher.notify(path: string): void
watcher.run(): Promise<void>
watcher.settle(): Promise<void>
watcher.close(): Promise<void>
```

`run()` starts a scan immediately. `settle()` only waits for a scan already in
progress.

## Projection state

`.jollypixel/state.json` stores the last projected event ID for each asset. It
is machine-local and can be recreated by replaying the event log. Projection
failures are retained there for inspection and retried by a later flush.

`.jollypixel/assets.json` has a different purpose. It maps paths to asset IDs
for discovery when a checkout has no local event log. Commit this file when
asset IDs must remain stable across checkouts.
