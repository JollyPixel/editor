# AssetBackend

`createAssetBackend` connects an `AssetSource` to an event store and starts
catalog projection, filesystem reconciliation and snapshot scheduling.

```ts
createAssetBackend(options: AssetBackendOptions): Promise<AssetBackend>
```

## Options

| Option | Default | Description |
|---|---|---|
| `source` | required | Physical asset storage. |
| `eventStore` | required | Event store used for asset and domain events. |
| `handlers` | `[]` | Asset kind handlers. Unmatched paths use `binary`. |
| `snapshot` | `2_000` / `30_000` ms | Default quiet and maximum snapshot delays. |
| `reconcileOnStart` | `true` | Scan the source when the backend starts. |
| `watch` | `true` | Watch sources that implement `watch()`. |
| `reconcileDebounce` | `200` ms | Quiet period before external changes are scanned. |
| `logger` | silent | A `loglayer` logger. |
| `timers` | system timers | Injectable clock used by scheduling. |

A handler may override either default snapshot delay. See
[Asset kinds](./AssetKinds.md#snapshot-policy).

## Returned backend

```ts
interface AssetBackend extends AsyncDisposable {
  readonly source: AssetSource;
  readonly eventStore: EventStore;
  readonly kinds: AssetKindRegistry;
  readonly writer: AssetWriter;
  readonly catalog: CatalogProjection;

  flush(assetId?: string): Promise<void>;
  attach(server: Server, options?: { graceMs?: number }): () => void;
  close(): Promise<void>;
}
```

Use [`writer`](./AssetWriter.md) for asset mutations. `flush(assetId?)` waits
for pending snapshots and source writes for one asset, or for every pending
asset when the ID is omitted.

`attach(server)` registers the `asset-catalog` room and installs the dynamic
asset-room resolver. Its callback clears the resolver. Existing rooms and the
catalog room remain owned by the `Server` until `server.close()`.

Close the server before the backend so active asset rooms can flush while the
backend is still running. `close()` stops watching, flushes pending work and
releases backend subscriptions. It does not close the injected server or event
store. `[Symbol.asyncDispose]` calls `close()`.

The returned object also exposes `internals` for tests and hosts that need to
drive an individual stage. Normal application code should use `writer`,
`catalog`, `flush()` and `attach()`.

## Workspace files

`createAssetBackend` manages these files under the source root:

```text
.jollypixel/
  assets.json
  state.json
  .gitignore
```

Commit `assets.json` so paths keep the same asset IDs when a checkout has no
local event log. `state.json` stores machine-local projection positions and is
ignored by the generated `.gitignore`. The host chooses where the event store
is persisted.
