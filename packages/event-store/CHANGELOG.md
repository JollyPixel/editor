# @jolly-pixel/event-store

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
