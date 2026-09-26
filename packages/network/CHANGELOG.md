# @jolly-pixel/network

## 5.0.0

### Major Changes

- [#789](https://github.com/JollyPixel/editor/pull/789) [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285) Thanks [@fraxken](https://github.com/fraxken)! - Subpaths follow one naming scheme: `network/node` (now with the Vite plugin), `asset-server/{client,node}`, `asset-source/node`, `event-store/node` (was `./sqlite`), `image/browser` and `voxel.renderer/engine` (the Rapier plugin joins the root). `.ts` keys, wildcards, `network/parser` and `network/transport/*` are removed; transports ship from the network root, `./client` and `./node`.
  The `asset-server` and `asset-source` roots are now browser-safe and absorb `./backend`, `./kinds`, `./core` and `./indexeddb`; Node-only code moves to `./node`.
  Every published package declares `exports` instead of `main`/`types`, and the packages with no import-time side effects declare `"sideEffects": false`.

### Minor Changes

- [#788](https://github.com/JollyPixel/editor/pull/788) [`4a6ffd0`](https://github.com/JollyPixel/editor/commit/4a6ffd0841535389f5c61246cbf8d5b45d9f408e) Thanks [@fraxken](https://github.com/fraxken)! - Add `SchemaParser`, which checks a value against one JSON Schema and returns a typed `Result`. It is exported from the package root.

## 4.0.0

### Major Changes

- [#743](https://github.com/JollyPixel/editor/pull/743) [`6321913`](https://github.com/JollyPixel/editor/commit/632191387a3708bbefaebfc8f59bf0c105c4f242) Thanks [@fraxken](https://github.com/fraxken)! - Move password authentication and worker proxies to `network/node`; register workers as extension instances.
  Support browser timers and snapshot mutable asset inputs before asynchronous writes.

### Minor Changes

- [#760](https://github.com/JollyPixel/editor/pull/760) [`8d2c08f`](https://github.com/JollyPixel/editor/commit/8d2c08f484a8ab7b1ef055c6d45c8267f7c6fc6d) Thanks [@fraxken](https://github.com/fraxken)! - Add `ChannelTransport` and `ChannelTransportHost` (`@jolly-pixel/network/transport/channel.ts`) to relay client connections over a `BroadcastChannel`, `MessagePort` or worker.

- [#743](https://github.com/JollyPixel/editor/pull/743) [`6321913`](https://github.com/JollyPixel/editor/commit/632191387a3708bbefaebfc8f59bf0c105c4f242) Thanks [@fraxken](https://github.com/fraxken)! - The asset back-end can run inside a browser page: `LoopbackTransport` and `ClientOptions.socket` connect a `Client` to an in-process `Server`.
  New Node-free entries `@jolly-pixel/asset-source/core` and `@jolly-pixel/asset-server/backend`.
  Content hashes use WebCrypto: `writeData()` is async and `AssetWriter` applies writes one at a time, in call order.

## 3.0.0

### Major Changes

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

- [#659](https://github.com/JollyPixel/editor/pull/659) [`d61e341`](https://github.com/JollyPixel/editor/commit/d61e341ffbe1f555237cf0b586d628bf5c94c82f) Thanks [@fraxken](https://github.com/fraxken)! - The `asset-catalog` room now accepts `catalog:create`, `catalog:rename` and `catalog:delete` commands, attributed through the new `RoomContext.actor`, and rooms of deleted assets broadcast a final `deleted` notice.
  `AssetWriter` returns path, kind and path-conflict failures as error results instead of throwing, and refuses a path used by another asset.
  Remove `AssetKindHandler.createExtension`; `WorkerExtensionProxy` now implements `dispose()`.

## 2.0.0

### Major Changes

- [#623](https://github.com/JollyPixel/editor/pull/623) [`02b3b44`](https://github.com/JollyPixel/editor/commit/02b3b44814abf14c24bfea237afababa6ff8b09c) Thanks [@fraxken](https://github.com/fraxken)! - Parse the wire with JSON Schema instead of hand-rolled guards. Envelopes split
  by direction (`Envelope.parseClient` / `parseServer`), and an extension now
  declares `protocols` in place of `events` and `getEventName`, so the room parses
  payloads and derives rights keys from the schema variant that matched.
  
  This fixes broadcast filtering: outbound payloads were gated on an event name
  they never carried, so with a rights table configured a `voxel.renderer.*` rule
  filtered the wrong key on every fan-out.

### Minor Changes

- [#528](https://github.com/JollyPixel/editor/pull/528) [`d6f6a22`](https://github.com/JollyPixel/editor/commit/d6f6a22e8d9a5644b1e27622aa00d5e1af594702) Thanks [@fraxken](https://github.com/fraxken)! - Cut editor boot time by stopping the client from re-uploading its whole
  placeholder atlas on every load, resuming asset replay from the last snapshot
  checkpoint, and letting rooms resolve without blocking one another.

- [#571](https://github.com/JollyPixel/editor/pull/571) [`c9fa209`](https://github.com/JollyPixel/editor/commit/c9fa2090fc08b3151f107290459dbd050a584186) Thanks [@fraxken](https://github.com/fraxken)! - `Mouse` tracks whether the pointer sits over the canvas as `hovering`, with
  `enter` and `leave` events, so a consumer can tell a live `position` from the
  stale one left behind when the pointer moves onto surrounding UI.
  `SyncAdapter.notifyLocal()` replays an event to the handler captured at
  `attach()`, which `VoxelSyncClient` now uses so a peer's edit reaches local
  observers, and hiding, showing or removing a layer marks every layer's chunks
  dirty for cross-layer face culling.

- [#628](https://github.com/JollyPixel/editor/pull/628) [`423db10`](https://github.com/JollyPixel/editor/commit/423db105df46e6ec7bb692beec0a37b1f9332fad) Thanks [@fraxken](https://github.com/fraxken)! - `Extension.onClientConnect`, `onClientDisconnect` and `onMessage` are now
  optional; the room skips a hook it does not find and drops such a message with a
  `debug` log. Implementations need the `override` modifier, as `dispose` already
  did, and a worker extension reports its hooks at ready time so an omitted one
  costs no RPC round-trip.

- [#520](https://github.com/JollyPixel/editor/pull/520) [`a9a6ca8`](https://github.com/JollyPixel/editor/commit/a9a6ca8279097ff6e64a800f797a96ab21597e1b) Thanks [@fraxken](https://github.com/fraxken)! - Add presence and locking: a `PresenceSource` port, a `path` property claiming a field lock on focus, and `RoomPresenceSource` under the new `./network` subpath.

### Patch Changes

- Updated dependencies [[`d6f6a22`](https://github.com/JollyPixel/editor/commit/d6f6a22e8d9a5644b1e27622aa00d5e1af594702), [`402c2d9`](https://github.com/JollyPixel/editor/commit/402c2d952e774d2c96ead24b7c8d11ef568128a9), [`402c2d9`](https://github.com/JollyPixel/editor/commit/402c2d952e774d2c96ead24b7c8d11ef568128a9), [`4ad1299`](https://github.com/JollyPixel/editor/commit/4ad12991dc15ff5bb2ac158f9d6d6b0ce6023fd4)]:
  - @jolly-pixel/event-store@3.0.0

## 1.1.0

### Minor Changes

- [#346](https://github.com/JollyPixel/editor/pull/346) [`2788a7e`](https://github.com/JollyPixel/editor/commit/2788a7e3c0d4f04ff22df415c4bd5270c3a1208a) Thanks [@fraxken](https://github.com/fraxken)! - Wire first implementation of @jolly-pixel/network

- [#369](https://github.com/JollyPixel/editor/pull/369) [`6f6594d`](https://github.com/JollyPixel/editor/commit/6f6594d9bea483ce53f61f3c92112c727d12bb7f) Thanks [@fraxken](https://github.com/fraxken)! - Implement minimal RBAC

- [#393](https://github.com/JollyPixel/editor/pull/393) [`1ead090`](https://github.com/JollyPixel/editor/commit/1ead09093bf7de77b56242d86693b49cae68b1e0) Thanks [@fraxken](https://github.com/fraxken)! - Implement Node.js worker_threads support for Extension

- [#347](https://github.com/JollyPixel/editor/pull/347) [`b568905`](https://github.com/JollyPixel/editor/commit/b56890527e918a637d41a17a7b41f1077268d04d) Thanks [@fraxken](https://github.com/fraxken)! - Improve network client API surface (reducing boilerplate required to setup a new client/connection).

- [#475](https://github.com/JollyPixel/editor/pull/475) [`4309016`](https://github.com/JollyPixel/editor/commit/4309016f04d38603c713c7a1a3f5e23e6e945076) Thanks [@clemgbld](https://github.com/clemgbld)! - refactor(network): replace custom glob implementation by picomatch

- [#370](https://github.com/JollyPixel/editor/pull/370) [`36c570c`](https://github.com/JollyPixel/editor/commit/36c570cf5bef538b7c59bb64b987b86f07cc91b9) Thanks [@fraxken](https://github.com/fraxken)! - Implement a minimalist Event Store workspace

- [#458](https://github.com/JollyPixel/editor/pull/458) [`cf91f93`](https://github.com/JollyPixel/editor/commit/cf91f9336c32d8cc709a7915d2aa2fad264403c3) Thanks [@fraxken](https://github.com/fraxken)! - Cleanup three frustum implementation and introduce new PresenceOnlyExtension to network package

- [#364](https://github.com/JollyPixel/editor/pull/364) [`cd003c3`](https://github.com/JollyPixel/editor/commit/cd003c39463f09a0735d9a58a9ac7eea0217399d) Thanks [@fraxken](https://github.com/fraxken)! - Make the network implementation easier for workspaces

- [#364](https://github.com/JollyPixel/editor/pull/364) [`cd003c3`](https://github.com/JollyPixel/editor/commit/cd003c39463f09a0735d9a58a9ac7eea0217399d) Thanks [@fraxken](https://github.com/fraxken)! - Add `ConflictTracker`, a per-key wrapper around `ConflictResolver` that replaces the ad-hoc `Map` + get/resolve/set bookkeeping each `*SyncServer` (voxel-renderer, pixel-draw-renderer) used to repeat for itself.

- [#357](https://github.com/JollyPixel/editor/pull/357) [`53f66fa`](https://github.com/JollyPixel/editor/commit/53f66faee0df0be9c7500648c24e1f30918a8e32) Thanks [@fraxken](https://github.com/fraxken)! - Add peer identity and presence metadata. `NetworkClient` now supports connection-wide `identity`, and `NetworkChannel` now adds `updatePresence(patch)`, `onPeerPresence`, and a synced `peers` map (including initial `sync` state).

- [#361](https://github.com/JollyPixel/editor/pull/361) [`34c1d7b`](https://github.com/JollyPixel/editor/commit/34c1d7b85bdf25f89988160cfdee1edeb4f7cf2f) Thanks [@fraxken](https://github.com/fraxken)! - Re-implement the network stack

### Patch Changes

- Updated dependencies [[`adc9689`](https://github.com/JollyPixel/editor/commit/adc9689bce2a1ab743b5a7ccfbfc507408a3f0e1), [`36c570c`](https://github.com/JollyPixel/editor/commit/36c570cf5bef538b7c59bb64b987b86f07cc91b9)]:
  - @jolly-pixel/event-store@2.0.0
