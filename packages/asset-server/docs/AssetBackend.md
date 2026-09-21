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
| `catalogMaxContentBytes` | 16 MiB | Decoded size cap of a `catalog:create` payload and of an archive. See [Catalog](./Catalog.md#network-room). |
| `logger` | silent | A `loglayer` logger. |

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
drive an individual stage. The stage classes are not exported from the package
root. Normal application code should use `writer`, `catalog`, `flush()` and
`attach()`.

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

## Browser entry

`@jolly-pixel/asset-server/backend` exports `createAssetBackend`, the kind
handlers, the event helpers, the writer, the asset rooms, `seedAssetSource`
and `silentLogger`. It leaves out `createAssetWorkspace`, the HTTP handlers and
the Vite plugins, and imports no Node.js builtin.

With a `MemoryAssetSource`, a memory event store and a
[`LoopbackTransport`](../../network/docs/Transports.md#loopbacktransport), the
whole back-end runs inside a page:

```ts
import {
  createAssetBackend,
  type AssetEventDataMap
} from "@jolly-pixel/asset-server/backend";
import { MemoryAssetSource } from "@jolly-pixel/asset-source/core";
import * as EventStore from "@jolly-pixel/event-store";
import { Server } from "@jolly-pixel/network";

const backend = await createAssetBackend({
  source: new MemoryAssetSource(),
  eventStore: EventStore.persistence.memory<AssetEventDataMap>(),
  handlers,
  watch: false
});
backend.attach(new Server());
```

Content hashes are SHA-256 digests computed with the WebCrypto API, which
Node.js and browsers both provide.
