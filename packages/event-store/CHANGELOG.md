# @jolly-pixel/event-store

## 5.0.0

### Major Changes

- [#962](https://github.com/JollyPixel/editor/pull/962) [`e330bb1`](https://github.com/JollyPixel/editor/commit/e330bb166a520f7dd4ae7cf4c0837bf721c7bb90) Thanks [@fraxken](https://github.com/fraxken)! - `reader.listFromCheckpoint` is replaced by `listFromCheckpoints({ assetId })`, and `writer` exposes only `append`: observe rejected appends with `subscribeRejections`.
  `createEventStore`, `EventLog`, `SqliteEventLog` and `SQL_SCHEMA` are no longer exported, and `EventLogClosedError` now is.

- [#1080](https://github.com/JollyPixel/editor/pull/1080) [`59fc78a`](https://github.com/JollyPixel/editor/commit/59fc78a35178c8a5eee14462eb8b27ace71d1e22) Thanks [@fraxken](https://github.com/fraxken)! - IndexedDB storage now runs on `idb` and always uses `globalThis.indexedDB`: the `factory` option is removed.
  `IndexedDbAssetSource` no longer upgrades databases made before the `folders` store, and `destroy` closes the sources still open on the database instead of waiting for them.

### Minor Changes

- [#1072](https://github.com/JollyPixel/editor/pull/1072) [`8406e0f`](https://github.com/JollyPixel/editor/commit/8406e0f1ad3f4f34f988e62c00c7da35e51f5396) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Add asset parts: a kind may declare `parts` to store its content as a manifest and part files in `<asset>.parts/`, checkpointed one generation per `asset.updated`.
  Tags, archives and seeding carry the parts, and a live room streams them: `live().parts` answers `subscribe-parts` and filters each command's broadcast, and a tag room sends every part. `CatalogFolders` takes `kinds`; `compact` takes `keep`.

- [#1034](https://github.com/JollyPixel/editor/pull/1034) [`5c9d715`](https://github.com/JollyPixel/editor/commit/5c9d7156f236fd7a2b3acae3c0a7c6f4ba6c8dd2) Thanks [@fraxken](https://github.com/fraxken)! - Add `persistence.indexeddb({ name, factory? })`, a browser backend that keeps the log in memory and writes every append, tag change and compaction to IndexedDB before returning.
  `persistence.indexeddb.destroy({ name, factory? })` deletes that database.

- [#962](https://github.com/JollyPixel/editor/pull/962) [`7bdb4dd`](https://github.com/JollyPixel/editor/commit/7bdb4ddbdb0eed8c2882ece4a3911fe43b9cc436) Thanks [@fraxken](https://github.com/fraxken)! - Add per-asset `tags` that keep their event through compaction (`UnknownEventError`, `EventTagConflictError`) and `reader.get(assetId, eventVersion)`.
  SQLite databases gain the `tags` table on their next open.

- [#869](https://github.com/JollyPixel/editor/pull/869) [`e646731`](https://github.com/JollyPixel/editor/commit/e646731d6968af9a58604f5b503950e73dfa9681) Thanks [@fraxken](https://github.com/fraxken)! - event-store adds `expectedVersion` appends (`EventVersionConflictError`) and per-asset `compact` (`assetId`); SQLite files open in WAL mode with incremental vacuum.
  asset-server snapshots no longer reload live state or drop commands appended while serializing, compacts before snapshots (`compactOnSnapshot`), caches room snapshots per version and reconciles only changed paths; `watch` reports readiness through `onReady` and skips initial and temporary entries.
  network room loggers no longer overwrite the shared logger context, and disabled debug logs skip building metadata.

- [#1045](https://github.com/JollyPixel/editor/pull/1045) [`695ee81`](https://github.com/JollyPixel/editor/commit/695ee81072bd90cae25c03e5e850ce214153278b) Thanks [@fraxken](https://github.com/fraxken)! - Settings change without a restart: `Server.replaceRights`, kind options via `ProjectFile.replace`, `KindPackage.withOptions` and `ProjectKinds`/`AssetKindRegistry.replace`, and `Accounts.replaceRoles`/`replaceAccessRequests`; `RightsPattern` is exported.
  Accounts store per-account `preferences` and report typed `AccountActivity` events; `listAll` pages newest first with `beforeEventId`.
  `OrbitFlyCamera` gains `invertY` and a `touchpadSwipe` look or pan mode.

### Patch Changes

- [#1021](https://github.com/JollyPixel/editor/pull/1021) [`334fb9b`](https://github.com/JollyPixel/editor/commit/334fb9b31baf67b797f0f9564ac4f6be2c689e11) Thanks [@fraxken](https://github.com/fraxken)! - Cache the catalog join snapshot and HTTP body per catalog revision, defer projection state saves of single-asset flushes by up to a second, and drop per-command allocations on asset room edits.
  A room validates and serializes a frozen outbound payload once and reuses it. The sqlite append no longer scans the asset's whole history to find its next version.

## 4.0.0

### Major Changes

- [#789](https://github.com/JollyPixel/editor/pull/789) [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285) Thanks [@fraxken](https://github.com/fraxken)! - Subpaths follow one naming scheme: `network/node` (now with the Vite plugin), `asset-server/{client,node}`, `asset-source/node`, `event-store/node` (was `./sqlite`), `image/browser` and `voxel.renderer/engine` (the Rapier plugin joins the root). `.ts` keys, wildcards, `network/parser` and `network/transport/*` are removed; transports ship from the network root, `./client` and `./node`.
  The `asset-server` and `asset-source` roots are now browser-safe and absorb `./backend`, `./kinds`, `./core` and `./indexeddb`; Node-only code moves to `./node`.
  Every published package declares `exports` instead of `main`/`types`, and the packages with no import-time side effects declare `"sideEffects": false`.

## 3.0.0

### Major Changes

- [#611](https://github.com/JollyPixel/editor/pull/611) [`402c2d9`](https://github.com/JollyPixel/editor/commit/402c2d952e774d2c96ead24b7c8d11ef568128a9) Thanks [@fraxken](https://github.com/fraxken)! - Move log subscription and single-asset checkpoint reads into the store: `EventStore.subscribe(listener, { eventTypePrefix })` replaces reaching through `writer.on("append")`, and `reader.listFromCheckpoint(assetId, checkpointEventTypes)` replaces `reader.lastVersionOf`.
  The sqlite backend now creates the directories its file lives in, so `openAssetEventStore` is gone from `@jolly-pixel/asset-server`.

### Minor Changes

- [#528](https://github.com/JollyPixel/editor/pull/528) [`d6f6a22`](https://github.com/JollyPixel/editor/commit/d6f6a22e8d9a5644b1e27622aa00d5e1af594702) Thanks [@fraxken](https://github.com/fraxken)! - Cut editor boot time by stopping the client from re-uploading its whole
  placeholder atlas on every load, resuming asset replay from the last snapshot
  checkpoint, and letting rooms resolve without blocking one another.

- [#611](https://github.com/JollyPixel/editor/pull/611) [`402c2d9`](https://github.com/JollyPixel/editor/commit/402c2d952e774d2c96ead24b7c8d11ef568128a9) Thanks [@fraxken](https://github.com/fraxken)! - Add an optional schema map to the persistence factories: they now return a
  `TypedEventStore<TMap>` whose `append` rejects an unknown event type or a
  payload that mismatches it, while reads stay `unknown` and still need a guard.
  Both backends also got faster through per-asset indexing, one fewer copy per
  append, and cached SQLite statements.

- [#594](https://github.com/JollyPixel/editor/pull/594) [`4ad1299`](https://github.com/JollyPixel/editor/commit/4ad12991dc15ff5bb2ac158f9d6d6b0ce6023fd4) Thanks [@fraxken](https://github.com/fraxken)! - Add `reader.listFromCheckpoints()` and `store.compact()`, so a fold that
  restarts from a checkpoint stops paying for the depth of the log. Both asset
  projections now load from each asset's newest lifecycle checkpoint, and opening
  a workspace compacts the events they supersede unless `compactOnOpen` is off.

## 2.0.0

### Major Changes

- [#382](https://github.com/JollyPixel/editor/pull/382) [`adc9689`](https://github.com/JollyPixel/editor/commit/adc9689bce2a1ab743b5a7ccfbfc507408a3f0e1) Thanks [@fraxken](https://github.com/fraxken)! - Keep the package entrypoint browser-compatible by loading the SQLite persistence lazily.

### Minor Changes

- [#370](https://github.com/JollyPixel/editor/pull/370) [`36c570c`](https://github.com/JollyPixel/editor/commit/36c570cf5bef538b7c59bb64b987b86f07cc91b9) Thanks [@fraxken](https://github.com/fraxken)! - Implement a minimalist Event Store workspace
