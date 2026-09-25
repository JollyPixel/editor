# AssetBackend

`createAssetBackend` connects an `AssetSource` to an event store and starts
catalog projection, filesystem reconciliation and snapshot scheduling.

```ts
createAssetBackend(options: AssetBackendOptions): Promise<AssetBackend>
```

## Options

```ts
interface AssetBackendOptions {
  source: AssetSource;
  eventStore: EventStore.TypedEventStore<AssetEventDataMap>;
  handlers?: AssetKindHandler[];
  snapshot?: SnapshotPolicy;
  reconcileOnStart?: boolean;
  watch?: boolean;
  reconcileDebounce?: number;
  catalogMaxContentBytes?: number;
  catalogArchiveLimits?: ArchiveLimits;
  catalogDeleteProtection?: boolean;
  logger?: Logger;
}
```

`source` and `eventStore` are required. `handlers` defaults to `[]`; unmatched
paths use the built-in `binary` kind.

`snapshot` sets the default quiet delay (2,000 ms) and maximum delay
(30,000 ms). A handler can override either value. See
[Asset kinds](./AssetKinds.md#snapshot-policy).

`reconcileOnStart` and `watch` default to `true`. `watch` only has an effect
when the source supports it. `reconcileDebounce` defaults to 200 ms.

`catalogMaxContentBytes` defaults to 16 MiB of decoded content for catalog
create and archive commands. See [Catalog](./Catalog.md#network-room).
`catalogArchiveLimits` caps the decoded entry and archive sizes of an
imported archive. See [readAssetArchive](./Archive.md#readassetarchive).
`catalogDeleteProtection` defaults to `true`. See
[Delete protection](./Catalog.md#delete-protection).
`logger` defaults to a silent logger.

## Returned backend

```ts
interface AssetBackend extends AsyncDisposable {
  readonly source: AssetSource;
  readonly eventStore: EventStore.TypedEventStore<AssetEventDataMap>;
  readonly kinds: AssetKindRegistry;
  readonly writer: AssetWriter;
  readonly catalog: CatalogProjection;
  readonly internals: AssetBackendInternals;

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
