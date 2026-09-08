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

Only inline content is supported. `AssetInlineContent` is that branch alone,
and it is what a parsed write payload carries, so `decodeContent()` cannot be
handed a reference. `encodeContent()`, `decodeContent()` and the event
constants are exported from the main package entrypoint.

### Typed payloads

Each payload type is derived from the JSON Schema that validates it, so the
schema and the type cannot drift. `AssetEventDataMap` binds each event type to
its payload, and `AssetEvent` is a stored event narrowed to a matching pair:

```ts
type AssetEventDataMap = {
  "asset.created": AssetWriteData;
  "asset.updated": AssetWriteData;
  "asset.renamed": AssetRenamedData;
  "asset.deleted": AssetDeletedData;
};
```

`parseAssetEvent(event)` parses a stored event against that map and returns
`Result<AssetEvent, AssetEventRejection>`. Readers use it instead of asserting
a payload shape, because events come back from persistence as parsed JSON.

A rejection says which of three things happened, and `describeRejection()`
renders it for a log:

| Reason | Meaning |
|---|---|
| `foreign` | another domain's event, or an `asset.` type this version does not know |
| `malformed` | an asset event whose payload fails its schema; carries the failing paths |
| `unsupported` | a well-formed write event carrying reference content |

Payload schemas accept unknown fields, so an event written by a newer version
of the backend stays readable rather than being skipped as malformed.

A rejected event is skipped rather than folded: the projector keeps the
asset's last good projection and warns for `malformed` and `unsupported`, and
the catalog keeps its last good record and returns `false` from `apply`.
Neither aborts a replay, so one corrupt row cannot stop the backend from
starting.

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
resolve, and concurrent callers share one replay. It re-reads the tail until
the stream stops growing, because events appended while it yielded land before
the entry starts following the log.

Those three types are exported as `ASSET_CHECKPOINT_EVENT_TYPES`. Loading a
projection uses the same bound: `AssetProjector.load()` and
`CatalogProjection.load()` read from each asset's newest checkpoint rather
than the head of the log, because an older `asset.created` or `asset.updated`
only produces a projection the replay overwrites. `asset.renamed` is not a
checkpoint: it folds onto the projection before it, and is read as part of the
tail. Startup cost therefore tracks the number of assets, not the depth of the
log. See [Workspace compaction](./Workspace.md#compaction) for removing what
this skips.

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
