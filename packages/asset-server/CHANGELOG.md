# @jolly-pixel/asset-server

## 3.0.0

### Major Changes

- [#662](https://github.com/JollyPixel/editor/pull/662) [`c0a3c5d`](https://github.com/JollyPixel/editor/commit/c0a3c5d646741d8997a78724603f90cff92a886e) Thanks [@fraxken](https://github.com/fraxken)! - `AssetKindHandler.apply(state, event)` and `live()` are replaced by `load`, `clear` and a `commands` object (`eventType`, `protocol`, `apply`, `live`); commands are validated against the `protocol` JSON Schema on append and replay.
  `AssetLiveProtocol` declares a `snapshotSchema` instead of `protocols`, which the room now derives, and no longer carries `commandEventType` or `parse`.
  Add `foldAssetEvent()`; `AssetStateStore` folds through it and logs a throwing hook instead of letting it escape.

- [#659](https://github.com/JollyPixel/editor/pull/659) [`853c83b`](https://github.com/JollyPixel/editor/commit/853c83b9070a249087dab57247bc8dad0605b781) Thanks [@fraxken](https://github.com/fraxken)! - Remove the unused `sync`, `catalog`, `rooms`, `static` and `workspace` subpath exports; import from the package root instead.
  Add a `kinds` entry exposing the asset kind handler contract, used by the renderer asset handlers.

- [#691](https://github.com/JollyPixel/editor/pull/691) [`26324fd`](https://github.com/JollyPixel/editor/commit/26324fde3b3922e1a3c1c33fb75cccfcfcbfe6e1) Thanks [@fraxken](https://github.com/fraxken)! - Narrow the root entry: projection, state, reconciliation and identity stages, `TaskChain`, `contentHash`, `CatalogClient`, `AssetRoom`, `DEFAULT_CATALOG_PATH` and `STATE_DIRECTORY` are no longer exported (use `CATALOG_URL_PATH` and `AssetRoom` from `@jolly-pixel/asset`).
  Snapshots go through `AssetWriter.update()`, and `AssetWriter.create()` reuses the sidecar ID of a vacant path; `AssetWriter` and `Reconciler` drop their `source` and `kinds` options, and `texture` declares no `contentTypes`.

- [#690](https://github.com/JollyPixel/editor/pull/690) [`619e2a7`](https://github.com/JollyPixel/editor/commit/619e2a7c5599efb41e77d039c8a112ef02eabcc2) Thanks [@fraxken](https://github.com/fraxken)! - Move `createAssetStaticHandler` and the content-type helpers to `@jolly-pixel/asset-source`.
  The handler drops its `kinds` option; pass `registry.contentTypes()` as `contentTypes` instead.
  `contentTypesFromKinds`, `DEFAULT_ASSET_PREFIX` and `AssetStaticPluginOptions` are removed (use `AssetKindRegistry.contentTypes()`, `ASSET_URL_PREFIX` and `AssetStaticHandlerOptions`).

- [#636](https://github.com/JollyPixel/editor/pull/636) [`f0363be`](https://github.com/JollyPixel/editor/commit/f0363bea0dafae6f2e899b491c6f4c6d4f777acb) Thanks [@fraxken](https://github.com/fraxken)! - Add native existence checks and atomic conditional writes to `AssetSource`.
  Use conditional writes when initializing workspace assets and state files.

- [#659](https://github.com/JollyPixel/editor/pull/659) [`d61e341`](https://github.com/JollyPixel/editor/commit/d61e341ffbe1f555237cf0b586d628bf5c94c82f) Thanks [@fraxken](https://github.com/fraxken)! - The `asset-catalog` room now accepts `catalog:create`, `catalog:rename` and `catalog:delete` commands, attributed through the new `RoomContext.actor`, and rooms of deleted assets broadcast a final `deleted` notice.
  `AssetWriter` returns path, kind and path-conflict failures as error results instead of throwing, and refuses a path used by another asset.
  Remove `AssetKindHandler.createExtension`; `WorkerExtensionProxy` now implements `dispose()`.

- [#689](https://github.com/JollyPixel/editor/pull/689) [`81f9fcc`](https://github.com/JollyPixel/editor/commit/81f9fcc003a62bb102e5f0cfb4cf439165778ccf) Thanks [@fraxken](https://github.com/fraxken)! - The engine declares a world's tilesets in `engine.tilesets` (`TilesetList`), saved with `defaultTileSize`; `TileRef.size`, tile rescale/rect helpers are added and `load()` warns instead of throwing for an unloaded tileset.
  `VoxelEngine` and `VoxelWorld` are now emitters: one `"command"` event (`VoxelCommand` + `origin`) and `engine.apply()` replace `onLayerUpdated`/`onBlockUpdated`/`onTilesetUpdated`, `applyRemoteCommand()` and `applyTilesetEvent()`; `applyVoxelCommand()` applies commands headlessly.
  Add the browser `CatalogClient` (`@jolly-pixel/asset-server/catalog/client`), `catalog:create` `onConflict: "suffix"` and seed entries with a fixed `AssetId`; add the `AssetSource` value object and `createPixelArtDocument()`; `AssetRoom` replaces `assetRoomName()`/`parseAssetRoomName()`.

- [#639](https://github.com/JollyPixel/editor/pull/639) [`55a1230`](https://github.com/JollyPixel/editor/commit/55a12309b7e3d4a3c7ba7efc47766655abaf10f9) Thanks [@fraxken](https://github.com/fraxken)! - Authenticate connections at the WebSocket handshake through a server-configured
  `AuthenticationProvider`, and split the trusted `PeerIdentity` from the client's
  untrusted `profile` (renamed from `identity`).
  Rooms now report a joining client's resolved rights, and a role absent from a
  configured rights table is denied instead of granted.

- [#662](https://github.com/JollyPixel/editor/pull/662) [`ae6293b`](https://github.com/JollyPixel/editor/commit/ae6293bf83ef24d0e91569994594a87221577ea2) Thanks [@fraxken](https://github.com/fraxken)! - Remove the event store from `@jolly-pixel/network`: `RoomContext` now carries the member `identity` instead of `eventStore`/`actor`, and `ServerOptions.eventStore` is gone.
  Asset rooms append through an injected event writer (`registerAssetRooms({ events })`) and send a `rejected` notice to the author when the append fails.

- [#664](https://github.com/JollyPixel/editor/pull/664) [`271fba9`](https://github.com/JollyPixel/editor/commit/271fba955fe79253b972a13daf0419a696138788) Thanks [@fraxken](https://github.com/fraxken)! - Replace `SyncAdapter` with `CommandSync`, add `PresenceChannel`, and slim `ConflictTracker` to `admit`/`admitEach`; presence set before `join()` now travels with the join.
  Asset rooms stamp the sender's `clientId` server-side, and three's peer syncs drop `resyncIntervalMs` and their message type parameters.

### Minor Changes

- [#678](https://github.com/JollyPixel/editor/pull/678) [`60bef9d`](https://github.com/JollyPixel/editor/commit/60bef9d4d51f63a269e31f26d1817399708f8b6a) Thanks [@fraxken](https://github.com/fraxken)! - Add `closable` and `tooltip` to `jolly-tab`: a closable tab emits `jolly-tab-close` with `{ value }`, and `jolly-tabs` re-renders when tab properties change.
  Add the `catalogMaxContentBytes` backend option to raise or lower the `catalog:create` size cap.

### Patch Changes

- Updated dependencies [[`619e2a7`](https://github.com/JollyPixel/editor/commit/619e2a7c5599efb41e77d039c8a112ef02eabcc2), [`f0363be`](https://github.com/JollyPixel/editor/commit/f0363bea0dafae6f2e899b491c6f4c6d4f777acb), [`d61e341`](https://github.com/JollyPixel/editor/commit/d61e341ffbe1f555237cf0b586d628bf5c94c82f), [`81f9fcc`](https://github.com/JollyPixel/editor/commit/81f9fcc003a62bb102e5f0cfb4cf439165778ccf), [`55a1230`](https://github.com/JollyPixel/editor/commit/55a12309b7e3d4a3c7ba7efc47766655abaf10f9), [`ae6293b`](https://github.com/JollyPixel/editor/commit/ae6293bf83ef24d0e91569994594a87221577ea2), [`271fba9`](https://github.com/JollyPixel/editor/commit/271fba955fe79253b972a13daf0419a696138788)]:
  - @jolly-pixel/asset-source@2.0.0
  - @jolly-pixel/network@3.0.0
  - @jolly-pixel/asset@2.0.0

## 2.0.0

### Major Changes

- [#613](https://github.com/JollyPixel/editor/pull/613) [`ac9bcf8`](https://github.com/JollyPixel/editor/commit/ac9bcf8696b154763828b36d09511c046cd4f036) Thanks [@fraxken](https://github.com/fraxken)! - Extract filesystem and in-memory storage into `@jolly-pixel/asset-source`.
  BREAKING: Remove storage providers and path helpers from `asset-server`.

- [#612](https://github.com/JollyPixel/editor/pull/612) [`6b09dd6`](https://github.com/JollyPixel/editor/commit/6b09dd6faa48f8d8600cf4a8e8a3b9126b24afb9) Thanks [@fraxken](https://github.com/fraxken)! - Parse asset event payloads instead of validating them. `isAssetEvent` becomes
  `parseAssetEvent`, returning `Result<AssetEvent, AssetEventRejection>` that
  separates a foreign event from a malformed one; payload types now derive from
  the JSON Schemas that check them, and `decodeContent` takes `AssetInlineContent`
  so it can no longer throw.

- [#623](https://github.com/JollyPixel/editor/pull/623) [`02b3b44`](https://github.com/JollyPixel/editor/commit/02b3b44814abf14c24bfea237afababa6ff8b09c) Thanks [@fraxken](https://github.com/fraxken)! - Parse the wire with JSON Schema instead of hand-rolled guards. Envelopes split
  by direction (`Envelope.parseClient` / `parseServer`), and an extension now
  declares `protocols` in place of `events` and `getEventName`, so the room parses
  payloads and derives rights keys from the schema variant that matched.
  
  This fixes broadcast filtering: outbound payloads were gated on an event name
  they never carried, so with a rights table configured a `voxel.renderer.*` rule
  filtered the wrong key on every fan-out.

- [#611](https://github.com/JollyPixel/editor/pull/611) [`402c2d9`](https://github.com/JollyPixel/editor/commit/402c2d952e774d2c96ead24b7c8d11ef568128a9) Thanks [@fraxken](https://github.com/fraxken)! - Move log subscription and single-asset checkpoint reads into the store: `EventStore.subscribe(listener, { eventTypePrefix })` replaces reaching through `writer.on("append")`, and `reader.listFromCheckpoint(assetId, checkpointEventTypes)` replaces `reader.lastVersionOf`.
  The sqlite backend now creates the directories its file lives in, so `openAssetEventStore` is gone from `@jolly-pixel/asset-server`.

### Minor Changes

- [#618](https://github.com/JollyPixel/editor/pull/618) [`d6b2a37`](https://github.com/JollyPixel/editor/commit/d6b2a37da51adcbfc84267c5276958299f58eb7b) Thanks [@fraxken](https://github.com/fraxken)! - Replace the per-kind room extension with a declarative `live()` protocol hosted
  by asset-server's new `AssetRoomExtension`. `PixelArtAssetExtension` and
  `VoxelMapAssetExtension` are removed; `PixelCommandArbiter.admit()` now defers
  recording to the returned arbitration, so a refused append no longer poisons
  the conflict trackers.

- [#528](https://github.com/JollyPixel/editor/pull/528) [`d6f6a22`](https://github.com/JollyPixel/editor/commit/d6f6a22e8d9a5644b1e27622aa00d5e1af594702) Thanks [@fraxken](https://github.com/fraxken)! - Cut editor boot time by stopping the client from re-uploading its whole
  placeholder atlas on every load, resuming asset replay from the last snapshot
  checkpoint, and letting rooms resolve without blocking one another.

- [#594](https://github.com/JollyPixel/editor/pull/594) [`4ad1299`](https://github.com/JollyPixel/editor/commit/4ad12991dc15ff5bb2ac158f9d6d6b0ce6023fd4) Thanks [@fraxken](https://github.com/fraxken)! - Add `reader.listFromCheckpoints()` and `store.compact()`, so a fold that
  restarts from a checkpoint stops paying for the depth of the log. Both asset
  projections now load from each asset's newest lifecycle checkpoint, and opening
  a workspace compacts the events they supersede unless `compactOnOpen` is off.

### Patch Changes

- [#611](https://github.com/JollyPixel/editor/pull/611) [`402c2d9`](https://github.com/JollyPixel/editor/commit/402c2d952e774d2c96ead24b7c8d11ef568128a9) Thanks [@fraxken](https://github.com/fraxken)! - Add an optional schema map to the persistence factories: they now return a
  `TypedEventStore<TMap>` whose `append` rejects an unknown event type or a
  payload that mismatches it, while reads stay `unknown` and still need a guard.
  Both backends also got faster through per-asset indexing, one fewer copy per
  append, and cached SQLite statements.

- [#628](https://github.com/JollyPixel/editor/pull/628) [`423db10`](https://github.com/JollyPixel/editor/commit/423db105df46e6ec7bb692beec0a37b1f9332fad) Thanks [@fraxken](https://github.com/fraxken)! - `Extension.onClientConnect`, `onClientDisconnect` and `onMessage` are now
  optional; the room skips a hook it does not find and drops such a message with a
  `debug` log. Implementations need the `override` modifier, as `dispose` already
  did, and a worker extension reports its hooks at ready time so an omitted one
  costs no RPC round-trip.
- Updated dependencies [[`18842ab`](https://github.com/JollyPixel/editor/commit/18842abe5ad347f63eacf8254d0685cba235adee), [`d6f6a22`](https://github.com/JollyPixel/editor/commit/d6f6a22e8d9a5644b1e27622aa00d5e1af594702), [`c9fa209`](https://github.com/JollyPixel/editor/commit/c9fa2090fc08b3151f107290459dbd050a584186), [`402c2d9`](https://github.com/JollyPixel/editor/commit/402c2d952e774d2c96ead24b7c8d11ef568128a9), [`423db10`](https://github.com/JollyPixel/editor/commit/423db105df46e6ec7bb692beec0a37b1f9332fad), [`c5e4f38`](https://github.com/JollyPixel/editor/commit/c5e4f38bafbc56cfba7a5de5d5f66e3ed1cf6f65), [`02b3b44`](https://github.com/JollyPixel/editor/commit/02b3b44814abf14c24bfea237afababa6ff8b09c), [`a9a6ca8`](https://github.com/JollyPixel/editor/commit/a9a6ca8279097ff6e64a800f797a96ab21597e1b), [`402c2d9`](https://github.com/JollyPixel/editor/commit/402c2d952e774d2c96ead24b7c8d11ef568128a9), [`4ad1299`](https://github.com/JollyPixel/editor/commit/4ad12991dc15ff5bb2ac158f9d6d6b0ce6023fd4)]:
  - @jolly-pixel/asset@1.1.0
  - @jolly-pixel/event-store@3.0.0
  - @jolly-pixel/network@2.0.0
