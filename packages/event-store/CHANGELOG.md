# @jolly-pixel/event-store

## 6.0.0

### Major Changes

- [#1128](https://github.com/JollyPixel/editor/pull/1128) [`75493f9`](https://github.com/JollyPixel/editor/commit/75493f9032176bfa25b4758b867c22f5b36c872f) Thanks [@fraxken](https://github.com/fraxken)! - Every event store member is async, and stores dispose with `await using`.

### Minor Changes

- [#1195](https://github.com/JollyPixel/editor/pull/1195) [`00f50e5`](https://github.com/JollyPixel/editor/commit/00f50e5af2be1dcb0d11a6731330ffb823a6f802) Thanks [@fraxken](https://github.com/fraxken)! - `eventData` keeps `Uint8Array` values and reads them back as bytes; SQLite stores them raw in a new `event_bytes` BLOB column, added on open. `$bytes` is now a reserved key.

- [#1246](https://github.com/JollyPixel/editor/pull/1246) [`b6be924`](https://github.com/JollyPixel/editor/commit/b6be924139de006228f9eb9e93480e0f21aa8201) Thanks [@fraxken](https://github.com/fraxken)! - Add `reader.iterateAll(options)`, which yields the same events as `listAll` while fetching the log one page at a time.

## 5.0.0

### Major Changes

- [#962](https://github.com/JollyPixel/editor/pull/962) [`e330bb1`](https://github.com/JollyPixel/editor/commit/e330bb166a520f7dd4ae7cf4c0837bf721c7bb90) Thanks [@fraxken](https://github.com/fraxken)! - Use `listFromCheckpoints({ assetId })` instead of `reader.listFromCheckpoint` and `subscribeRejections` to observe rejected appends; `createEventStore`, `EventLog` and `SQL_SCHEMA` are no longer exported.

- [#1080](https://github.com/JollyPixel/editor/pull/1080) [`59fc78a`](https://github.com/JollyPixel/editor/commit/59fc78a35178c8a5eee14462eb8b27ace71d1e22) Thanks [@fraxken](https://github.com/fraxken)! - IndexedDB storage always uses `globalThis.indexedDB` (the `factory` option is removed), and databases older than the `folders` store are no longer upgraded.

### Minor Changes

- [#1072](https://github.com/JollyPixel/editor/pull/1072) [`8406e0f`](https://github.com/JollyPixel/editor/commit/8406e0f1ad3f4f34f988e62c00c7da35e51f5396) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Asset kinds can store their content as a manifest plus part files, and live rooms stream only the parts each member subscribes to.

- [#1034](https://github.com/JollyPixel/editor/pull/1034) [`5c9d715`](https://github.com/JollyPixel/editor/commit/5c9d7156f236fd7a2b3acae3c0a7c6f4ba6c8dd2) Thanks [@fraxken](https://github.com/fraxken)! - Add an IndexedDB persistence backend for browsers (`persistence.indexeddb`).

- [#962](https://github.com/JollyPixel/editor/pull/962) [`7bdb4dd`](https://github.com/JollyPixel/editor/commit/7bdb4ddbdb0eed8c2882ece4a3911fe43b9cc436) Thanks [@fraxken](https://github.com/fraxken)! - Add per-asset `tags` that keep their event through compaction (`UnknownEventError`, `EventTagConflictError`) and `reader.get(assetId, eventVersion)`.
  SQLite databases gain the `tags` table on their next open.

- [#869](https://github.com/JollyPixel/editor/pull/869) [`e646731`](https://github.com/JollyPixel/editor/commit/e646731d6968af9a58604f5b503950e73dfa9681) Thanks [@fraxken](https://github.com/fraxken)! - The event store adds `expectedVersion` appends and per-asset compaction, SQLite runs in WAL mode, and asset snapshots and reconciliation are faster and no longer drop commands.

- [#1045](https://github.com/JollyPixel/editor/pull/1045) [`695ee81`](https://github.com/JollyPixel/editor/commit/695ee81072bd90cae25c03e5e850ce214153278b) Thanks [@fraxken](https://github.com/fraxken)! - Rights, roles, kind options and access requests can change without a restart. Accounts store per-account `preferences`. `OrbitFlyCamera` gains `invertY` and touchpad swipe modes.

### Patch Changes

- [#1021](https://github.com/JollyPixel/editor/pull/1021) [`334fb9b`](https://github.com/JollyPixel/editor/commit/334fb9b31baf67b797f0f9564ac4f6be2c689e11) Thanks [@fraxken](https://github.com/fraxken)! - Faster catalog joins and asset room edits, and SQLite appends no longer scan an asset's whole history.

## 4.0.0

### Major Changes

- [#789](https://github.com/JollyPixel/editor/pull/789) [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285) Thanks [@fraxken](https://github.com/fraxken)! - Package subpaths follow one naming scheme (`/node`, `/client`, `/browser`), and every package declares `exports`; for example, import `event-store/node` instead of `event-store/sqlite`. Package roots are browser-safe.

## 3.0.0

### Major Changes

- [#611](https://github.com/JollyPixel/editor/pull/611) [`402c2d9`](https://github.com/JollyPixel/editor/commit/402c2d952e774d2c96ead24b7c8d11ef568128a9) Thanks [@fraxken](https://github.com/fraxken)! - Use `EventStore.subscribe` and `reader.listFromCheckpoint` instead of `writer.on("append")` and `reader.lastVersionOf`; `openAssetEventStore` is removed.

### Minor Changes

- [#528](https://github.com/JollyPixel/editor/pull/528) [`d6f6a22`](https://github.com/JollyPixel/editor/commit/d6f6a22e8d9a5644b1e27622aa00d5e1af594702) Thanks [@fraxken](https://github.com/fraxken)! - Cut editor boot time by stopping the client from re-uploading its whole
  placeholder atlas on every load, resuming asset replay from the last snapshot
  checkpoint, and letting rooms resolve without blocking one another.

- [#611](https://github.com/JollyPixel/editor/pull/611) [`402c2d9`](https://github.com/JollyPixel/editor/commit/402c2d952e774d2c96ead24b7c8d11ef568128a9) Thanks [@fraxken](https://github.com/fraxken)! - Persistence factories take an optional schema map and reject unknown or mismatched events on append. Both backends are faster.

- [#594](https://github.com/JollyPixel/editor/pull/594) [`4ad1299`](https://github.com/JollyPixel/editor/commit/4ad12991dc15ff5bb2ac158f9d6d6b0ce6023fd4) Thanks [@fraxken](https://github.com/fraxken)! - Projections load from each asset's newest checkpoint, and opening a workspace compacts superseded events, so startup no longer grows with the log.

## 2.0.0

### Major Changes

- [#382](https://github.com/JollyPixel/editor/pull/382) [`adc9689`](https://github.com/JollyPixel/editor/commit/adc9689bce2a1ab743b5a7ccfbfc507408a3f0e1) Thanks [@fraxken](https://github.com/fraxken)! - Keep the package entrypoint browser-compatible by loading the SQLite persistence lazily.

### Minor Changes

- [#370](https://github.com/JollyPixel/editor/pull/370) [`36c570c`](https://github.com/JollyPixel/editor/commit/36c570cf5bef538b7c59bb64b987b86f07cc91b9) Thanks [@fraxken](https://github.com/fraxken)! - Implement a minimalist Event Store workspace
