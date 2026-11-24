# @jolly-pixel/network

## 7.0.1

### Patch Changes

- Updated dependencies [[`f711a5f`](https://github.com/JollyPixel/editor/commit/f711a5ff57a7d3513f7d2edb9a469b1f08884b25)]:
  - @jolly-pixel/utils@1.1.1

## 7.0.0

### Major Changes

- [#1195](https://github.com/JollyPixel/editor/pull/1195) [`033a975`](https://github.com/JollyPixel/editor/commit/033a975db5003d093263c9f9820c0fde7b00ff39) Thanks [@fraxken](https://github.com/fraxken)! - Binary frames are compressed only when the sender asks, through `SendOptions { compress }`, which replaces `compression.binary`. `PngPixels.data` is now a `Uint8Array`.

- [#1101](https://github.com/JollyPixel/editor/pull/1101) [`c1a8763`](https://github.com/JollyPixel/editor/commit/c1a87634da5e6c17e86fc3a1f9fcec587d9a5f64) Thanks [@fraxken](https://github.com/fraxken)! - Rename `KeyedSnapshot` to `KeyedCapture` and `CommandDocument.apply` to `applyRemote`. Documents, histories and receipts no longer extend `Emitter`: listen with `on`/`off`.

- [#1193](https://github.com/JollyPixel/editor/pull/1193) [`9a805e5`](https://github.com/JollyPixel/editor/commit/9a805e5fa847c30d41495bda22051e1aa6ed02f5) Thanks [@fraxken](https://github.com/fraxken)! - Messages carrying bytes travel as binary frames instead of JSON text. `ClientConnection.sendSerialized(json)` becomes `sendFrame(frame)`, and data channels send `Uint8Array` chunks.

- [#1284](https://github.com/JollyPixel/editor/pull/1284) [`8890073`](https://github.com/JollyPixel/editor/commit/8890073623d0035da1b8b662c1477d217e58a09b) Thanks [@fraxken](https://github.com/fraxken)! - Replace `limits.peerMetadataLength` with `profileLength`, `presenceLength` and `resumeLength`, and harden frame decoding, password throttling and channel relays.

- [#1237](https://github.com/JollyPixel/editor/pull/1237) [`5af0632`](https://github.com/JollyPixel/editor/commit/5af0632f9ae65a6005861f839adb4e97d22c209f) Thanks [@fraxken](https://github.com/fraxken)! - Asset kinds can declare capabilities, and one backend snapshot policy replaces the per-kind `snapshot` option. `jolly-text` gains `suggestions` and `select()`.

### Minor Changes

- [#1231](https://github.com/JollyPixel/editor/pull/1231) [`40b7a52`](https://github.com/JollyPixel/editor/commit/40b7a52eb6d394cfb4959aeb07abe807fb599bb0) Thanks [@fraxken](https://github.com/fraxken)! - `CatalogClient.connect` accepts an abort `signal`, client logs can be redirected with `consoleLogger`, and clients can apply raw commands to a synced document.

- [#1240](https://github.com/JollyPixel/editor/pull/1240) [`69ba6ea`](https://github.com/JollyPixel/editor/commit/69ba6ea57e3d74350f44c1b36e361c6c01ad2f8f) Thanks [@fraxken](https://github.com/fraxken)! - Add `server.disconnect(subject)` to close a subject's connections, which agent tokens use to drop an agent while keeping its token.

- [#1203](https://github.com/JollyPixel/editor/pull/1203) [`c41299e`](https://github.com/JollyPixel/editor/commit/c41299eab87538146550d8b4576f1516cd62badc) Thanks [@fraxken](https://github.com/fraxken)! - Asset kinds can serve previews through `CatalogClient.preview`, and peers can join as observers hidden from presence. Three adds `renderToTarget` and `ReadbackPixels`.

- [#1195](https://github.com/JollyPixel/editor/pull/1195) [`d9cb732`](https://github.com/JollyPixel/editor/commit/d9cb7324a3b32509a5e3c9be31f0342bf947053c) Thanks [@fraxken](https://github.com/fraxken)! - Large binary snapshots can be served as content refs fetched over HTTP instead of being inlined in the room, enabled with `AssetServer.open({ content })`.

- [#1178](https://github.com/JollyPixel/editor/pull/1178) [`5494a67`](https://github.com/JollyPixel/editor/commit/5494a67d7495071378b5eae430d51ef034cb5c35) Thanks [@fraxken](https://github.com/fraxken)! - Extensions can declare read-only `queries`, such as `CatalogClient.read(assetId)`. Kind resolution picks the longest matching extension.

- [#1206](https://github.com/JollyPixel/editor/pull/1206) [`24991a6`](https://github.com/JollyPixel/editor/commit/24991a6edf1f7230b9268ffa647151ebe52d808e) Thanks [@fraxken](https://github.com/fraxken)! - `decodeString` decodes a string presence value for `PresenceChannel`.

- [#1247](https://github.com/JollyPixel/editor/pull/1247) [`6f83ad9`](https://github.com/JollyPixel/editor/commit/6f83ad96f79668f426e90a6f7e183d6f676778ea) Thanks [@fraxken](https://github.com/fraxken)! - `WebsocketTransport` takes upgrades handed to `handleUpgrade`, and needs no `httpServer` or `path` when another listener routes upgrades to it.
  `connectWebSocket` accepts a `URL`, and turns an http: or https: URL into ws: or wss:.

- [#1231](https://github.com/JollyPixel/editor/pull/1231) [`40b7a52`](https://github.com/JollyPixel/editor/commit/40b7a52eb6d394cfb4959aeb07abe807fb599bb0) Thanks [@fraxken](https://github.com/fraxken)! - Peers can publish a short activity in their presence (e.g. "Placing trees · 40%"), shown by `jolly-presence-stack` on a second tooltip line.

- [#1231](https://github.com/JollyPixel/editor/pull/1231) [`40b7a52`](https://github.com/JollyPixel/editor/commit/40b7a52eb6d394cfb4959aeb07abe807fb599bb0) Thanks [@fraxken](https://github.com/fraxken)! - Export `PEER_FIELD_LOCK_KEY` and `parsePeerFieldLock(presence)`, the presence key editors publish a field lock under.

- [#1156](https://github.com/JollyPixel/editor/pull/1156) [`a89aeb7`](https://github.com/JollyPixel/editor/commit/a89aeb73fa118659494d3d9410dd9135fc39b551) Thanks [@fraxken](https://github.com/fraxken)! - Add `AssetLiveProtocol.authorRebases`, which skips the author's correction for kinds whose clients transform edits themselves, and a `reloaded()` hook called before a reload snapshot. `CommandSync` exposes its guarded `resync()` to subclasses.

### Patch Changes

- [#1212](https://github.com/JollyPixel/editor/pull/1212) [`0d95f1f`](https://github.com/JollyPixel/editor/commit/0d95f1f55a3020accd4e947a833aa68960267526) Thanks [@fraxken](https://github.com/fraxken)! - `ClientRoom` accepts up to 32 listeners per event, so an editor with one channel per collaboration concern no longer logs leak warnings.

- [#1234](https://github.com/JollyPixel/editor/pull/1234) [`90c9692`](https://github.com/JollyPixel/editor/commit/90c9692fc0508e2b784c097ed119090bfe07e850) Thanks [@fraxken](https://github.com/fraxken)! - Move shared helpers such as `delay`, `withTimeout`, `DeepReadonly` and `sha256Hex` into `@jolly-pixel/utils`.

- [#1192](https://github.com/JollyPixel/editor/pull/1192) [`d26da53`](https://github.com/JollyPixel/editor/commit/d26da53c969781c9c1c3062f6f0b6df2f5b8ecfa) Thanks [@fraxken](https://github.com/fraxken)! - Add `@jolly-pixel/utils` for shared helpers; `saveFile` and `formatBytes` move there from `@jolly-pixel/ui`.
- Updated dependencies [[`40b7a52`](https://github.com/JollyPixel/editor/commit/40b7a52eb6d394cfb4959aeb07abe807fb599bb0), [`40d00c4`](https://github.com/JollyPixel/editor/commit/40d00c45ca7946f8205cc8cdb01ff043af5d0c16), [`c1a8763`](https://github.com/JollyPixel/editor/commit/c1a87634da5e6c17e86fc3a1f9fcec587d9a5f64), [`7d1f07d`](https://github.com/JollyPixel/editor/commit/7d1f07da916e2f63622e4d3f49e24a4c4d3742ec), [`8a3c591`](https://github.com/JollyPixel/editor/commit/8a3c591b84dff46454fbad1717421400cad301c5), [`f5350de`](https://github.com/JollyPixel/editor/commit/f5350de576d82af8592928a4456f43702befff26), [`a2e6a27`](https://github.com/JollyPixel/editor/commit/a2e6a27dc11dedbd444ea7698158f320f1cb4402), [`f998437`](https://github.com/JollyPixel/editor/commit/f998437cc19077ec578beaf254cc826407e378f5), [`90c9692`](https://github.com/JollyPixel/editor/commit/90c9692fc0508e2b784c097ed119090bfe07e850), [`974ed36`](https://github.com/JollyPixel/editor/commit/974ed36053e2e6aab2a71cbc7e47e3e0fcb77f58)]:
  - @jolly-pixel/history@3.0.0
  - @jolly-pixel/utils@1.1.0

## 6.0.0

### Major Changes

- [#1009](https://github.com/JollyPixel/editor/pull/1009) [`5af5621`](https://github.com/JollyPixel/editor/commit/5af5621e4223fb97ab38b22530a64c0884d52051) Thanks [@fraxken](https://github.com/fraxken)! - `CommandSync` keeps every command while offline (the offline bound and `overflow` are removed), and pending commands can persist through a `ChangeOutbox`.

- [#1069](https://github.com/JollyPixel/editor/pull/1069) [`176b005`](https://github.com/JollyPixel/editor/commit/176b005c86d6d2e62e6d03780d26cf6f770e2650) Thanks [@fraxken](https://github.com/fraxken)! - Rename `createDocument(room)` to `syncDocument(room)`, `InvalidAssetDocumentError` to `InvalidAssetFileError`, `ProjectFile.document` to `ProjectFile.data`, and the `.pixelart` codec to `PixelArtFile`.

- [#924](https://github.com/JollyPixel/editor/pull/924) [`f174add`](https://github.com/JollyPixel/editor/commit/f174addea4b885bd601976b7fd730a91a0b047c4) Thanks [@fraxken](https://github.com/fraxken)! - `CommandDocument`, `ChangeReceipts` and `CommandHistory` move to the new `@jolly-pixel/history` package. The renderers no longer own undo: `PixelArtCanvas` takes a history from the host, and `VoxelHistory` is removed.

- [#1024](https://github.com/JollyPixel/editor/pull/1024) [`9123c45`](https://github.com/JollyPixel/editor/commit/9123c4578d791cb8f9d3749e56d2c8268ee87ec7) Thanks [@fraxken](https://github.com/fraxken)! - Rename methods named `xOf`, `xFor` or `getX`/`setX` after what they do (for example `inverseOf` → `invert`, `UVRegion.rectFor` → `slotRect`, `MessageParser.of` → `fromProtocol`).
  The package docs list the new names; behavior is unchanged.

- [#933](https://github.com/JollyPixel/editor/pull/933) [`02172bd`](https://github.com/JollyPixel/editor/commit/02172bd0a88a1db4612b76a41d78e424517f5ba0) Thanks [@fraxken](https://github.com/fraxken)! - Harden the servers: rights tables deny unmatched keys (end a role with `"*": "write"` to keep it open), WebSocket connections are checked and capped, and failed password logins are rate limited.

- [#941](https://github.com/JollyPixel/editor/pull/941) [`5fbedf2`](https://github.com/JollyPixel/editor/commit/5fbedf27124e3deb38992f3b70592b9536d9223c) Thanks [@fraxken](https://github.com/fraxken)! - `Server.connect(client, identity)` returns a `ServerConnection`, replacing `handleConnect`, `handleMessage` and `handleDisconnect`.

- [#1051](https://github.com/JollyPixel/editor/pull/1051) [`8323f7d`](https://github.com/JollyPixel/editor/commit/8323f7d1ac6ccb05c46407561cccf13a85098285) Thanks [@fraxken](https://github.com/fraxken)! - Drop `serverMessageProtocol`, `attributeCommand`, `ConflictTracker` and the `ConflictResolver` option; `CommandSync` requires a `reconciler`. Add the `SyncedDocument` base class.

- [#1025](https://github.com/JollyPixel/editor/pull/1025) [`3d53ea9`](https://github.com/JollyPixel/editor/commit/3d53ea9ae1d62eed99cde3dd80a1c8831deedffb) Thanks [@fraxken](https://github.com/fraxken)! - Transports decode the credential into `request.credential` and refuse a malformed one; `readCredential` and `InvalidCredentialError` are removed.

- [#1022](https://github.com/JollyPixel/editor/pull/1022) [`1a9db4f`](https://github.com/JollyPixel/editor/commit/1a9db4f0e48b42c9f23e302e117f24fcd1211e66) Thanks [@fraxken](https://github.com/fraxken)! - Schemas are written with zod instead of JSON Schema (`defineSchema` and `JSONSchema` are removed); kind packages export a zod `optionsSchema`.

### Minor Changes

- [#1021](https://github.com/JollyPixel/editor/pull/1021) [`334fb9b`](https://github.com/JollyPixel/editor/commit/334fb9b31baf67b797f0f9564ac4f6be2c689e11) Thanks [@fraxken](https://github.com/fraxken)! - Faster catalog joins and asset room edits, and SQLite appends no longer scan an asset's whole history.

- [#865](https://github.com/JollyPixel/editor/pull/865) [`35f9459`](https://github.com/JollyPixel/editor/commit/35f94598ed00f46dfd07152c752f8604d6ce436f) Thanks [@fraxken](https://github.com/fraxken)! - `ChannelTransport` can give each socket its own port, so a shared `BroadcastChannel` only carries connect messages.

- [#945](https://github.com/JollyPixel/editor/pull/945) [`ef2c7fe`](https://github.com/JollyPixel/editor/commit/ef2c7fe37e1d532b745e6462c26bb9f650ccc875) Thanks [@fraxken](https://github.com/fraxken)! - Profiles and avatars update live for every room member, without reconnecting.

- [#922](https://github.com/JollyPixel/editor/pull/922) [`12dca6e`](https://github.com/JollyPixel/editor/commit/12dca6e98be8b71f9ef8517edcc17d8e8520fb72) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Add `CommandHistory` for per-person undo and redo on synced documents, refusing a step a peer changed since. `jolly-tree` gains `validateRename` and row warnings.

- [#988](https://github.com/JollyPixel/editor/pull/988) [`c141b45`](https://github.com/JollyPixel/editor/commit/c141b453ebd7191ee44bd98b74825e8b9570264e) Thanks [@fraxken](https://github.com/fraxken)! - Add `DataChannelPort` to run the channel transport over an `RTCDataChannel`, and pass a `credential` through `ChannelTransport`.

- [#1019](https://github.com/JollyPixel/editor/pull/1019) [`9bcc044`](https://github.com/JollyPixel/editor/commit/9bcc044e1feaaed69f3344d17bff5b7e7f3ea797) Thanks [@fraxken](https://github.com/fraxken)! - Faster WebSocket writes and message handling, and an opt-in `trustServer` client option that skips server message checks.

- [#928](https://github.com/JollyPixel/editor/pull/928) [`c86b214`](https://github.com/JollyPixel/editor/commit/c86b214c710a64428fa251465f3bcd7984471a36) Thanks [@fraxken](https://github.com/fraxken)! - `PeerIdentity` gains an optional server-owned `profile`, merged over the client's profile on join.
  `@jolly-pixel/network/node` exports `hashPassword`, `verifyPassword` and `PasswordHash`.

- [#972](https://github.com/JollyPixel/editor/pull/972) [`85641f5`](https://github.com/JollyPixel/editor/commit/85641f5459de96c87aea28ae1ec5ef564991a760) Thanks [@fraxken](https://github.com/fraxken)! - `CommandSync` emits `unsettled` when `pending` leaves zero, and `settled` also after a discard.
  `SyncedCommandDocument.pendingChanges` exposes that count and both events as `PendingChanges`.

- [#868](https://github.com/JollyPixel/editor/pull/868) [`40e16a4`](https://github.com/JollyPixel/editor/commit/40e16a4ae92fdb94931b59e9ba80af52330b1bc4) Thanks [@fraxken](https://github.com/fraxken)! - Harden envelope parsing against prototype pollution, and reject malformed credentials with `InvalidCredentialError`.

- [#940](https://github.com/JollyPixel/editor/pull/940) [`27cff63`](https://github.com/JollyPixel/editor/commit/27cff63c507ae72b62c0299999590c839f2ac492) Thanks [@fraxken](https://github.com/fraxken)! - `Server.revoke(subject)` closes a subject's connections with code `4001` so clients authenticate again.
  Providers may implement `watchRevocations` to trigger it, and `ClientHandle` gains an optional `close(code, reason)`.

- [#954](https://github.com/JollyPixel/editor/pull/954) [`28dae7b`](https://github.com/JollyPixel/editor/commit/28dae7b8ef17f600128ba02cfe33436afadf1c92) Thanks [@fraxken](https://github.com/fraxken)! - Add `CapabilityTable`, `Grants` and `RoomGrants` to group room events into capabilities and follow a client's grants across `sync`, forwarding governed `denied` refusals.

- [#985](https://github.com/JollyPixel/editor/pull/985) [`13c7153`](https://github.com/JollyPixel/editor/commit/13c7153fcd2cfded9e0f9be6536e0aae8440ba19) Thanks [@fraxken](https://github.com/fraxken)! - Add `WebsocketTransport[Symbol.dispose]()`, which terminates the transport's sockets without waiting for the HTTP server to close.

- [#930](https://github.com/JollyPixel/editor/pull/930) [`a75ee6d`](https://github.com/JollyPixel/editor/commit/a75ee6dc5ef94c274f0f3b69d8eeff73e018e495) Thanks [@fraxken](https://github.com/fraxken)! - `createWebSocketNetworkPlugin` also serves rooms from `vite preview`.

- [#968](https://github.com/JollyPixel/editor/pull/968) [`a1c9713`](https://github.com/JollyPixel/editor/commit/a1c9713eafcdf644030bd565c4e119b84e3cfea8) Thanks [@fraxken](https://github.com/fraxken)! - `Client.reconnect()` reopens a client the server refused as `unauthorized`, so framed editors can renew an expired session.

- [#963](https://github.com/JollyPixel/editor/pull/963) [`f20007a`](https://github.com/JollyPixel/editor/commit/f20007a1717a9b9bbab779489156c36451be38a0) Thanks [@fraxken](https://github.com/fraxken)! - Add view-only share links: guests see a read-only catalog limited to one asset and what it depends on.

- [#1045](https://github.com/JollyPixel/editor/pull/1045) [`695ee81`](https://github.com/JollyPixel/editor/commit/695ee81072bd90cae25c03e5e850ce214153278b) Thanks [@fraxken](https://github.com/fraxken)! - Rights, roles, kind options and access requests can change without a restart. Accounts store per-account `preferences`. `OrbitFlyCamera` gains `invertY` and touchpad swipe modes.

- [#977](https://github.com/JollyPixel/editor/pull/977) [`6b9daee`](https://github.com/JollyPixel/editor/commit/6b9daee5304c6bf06fd77086633e682d35640afc) Thanks [@fraxken](https://github.com/fraxken)! - Open an asset at a tag, read-only, through tag rooms (`kind@tag:assetId`). `RightsGate.configured` becomes `gated`.

- [#1048](https://github.com/JollyPixel/editor/pull/1048) [`e1e86cb`](https://github.com/JollyPixel/editor/commit/e1e86cb232b5e021d839a58b8b68013194308349) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Relay schemas move to `AssetCommands.relay`, and `./testing` adds `LiveAssetRoom` and `mockAssetRoom`. Network adds `KeyedCommandArbiter`; `SyncedCommandDocument` now takes `<TDocument, TNotice>`.

- [#967](https://github.com/JollyPixel/editor/pull/967) [`75902c5`](https://github.com/JollyPixel/editor/commit/75902c51ba6fb64d72d322e9bc73a80e8dcfbce2) Thanks [@fraxken](https://github.com/fraxken)! - Peers are keyed by connection and read from `room.profile`. `ui` drops the `read*` presence helpers and renames `presencePeerOf`/`toPeerMetadata` to `toPresencePeer`/`toPeerProfileMetadata`.

### Patch Changes

- [#1019](https://github.com/JollyPixel/editor/pull/1019) [`e91817e`](https://github.com/JollyPixel/editor/commit/e91817e4dc21e0f659340de5ab426cdec4d45067) Thanks [@fraxken](https://github.com/fraxken)! - Update ata-validator to 1.53.0 and recompile the envelope validators.
  A protocol that declares no message now rejects payloads without running the union validator.

- [#869](https://github.com/JollyPixel/editor/pull/869) [`e646731`](https://github.com/JollyPixel/editor/commit/e646731d6968af9a58604f5b503950e73dfa9681) Thanks [@fraxken](https://github.com/fraxken)! - The event store adds `expectedVersion` appends and per-asset compaction, SQLite runs in WAL mode, and asset snapshots and reconciliation are faster and no longer drop commands.
- Updated dependencies [[`5af5621`](https://github.com/JollyPixel/editor/commit/5af5621e4223fb97ab38b22530a64c0884d52051), [`a23ea74`](https://github.com/JollyPixel/editor/commit/a23ea74dca38f8684e890f0abed659277ccc230e), [`9123c45`](https://github.com/JollyPixel/editor/commit/9123c4578d791cb8f9d3749e56d2c8268ee87ec7)]:
  - @jolly-pixel/history@2.0.0

## 5.0.0

### Major Changes

- [#794](https://github.com/JollyPixel/editor/pull/794) [`e206538`](https://github.com/JollyPixel/editor/commit/e2065388190abbe17facabbbe64fac562fa628de) Thanks [@fraxken](https://github.com/fraxken)! - `Client` takes a `socket` factory instead of `id`/`url`/`credential`, rooms get a stricter lifecycle, and the `MessageProtocol` class replaces `defineMessageProtocol`.

- [#789](https://github.com/JollyPixel/editor/pull/789) [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285) Thanks [@fraxken](https://github.com/fraxken)! - Package subpaths follow one naming scheme (`/node`, `/client`, `/browser`), and every package declares `exports`; for example, import `event-store/node` instead of `event-store/sqlite`. Package roots are browser-safe.

### Minor Changes

- [#845](https://github.com/JollyPixel/editor/pull/845) [`399e1e4`](https://github.com/JollyPixel/editor/commit/399e1e448a7cab33990ccb000c381ec266060de5) Thanks [@fraxken](https://github.com/fraxken)! - Add `renderOnDemand` to `Runtime`: the loop sleeps when nothing changes, and cameras, voxel views and peer syncs request the frames they need. Room joins load a much smaller snapshot.

- [#820](https://github.com/JollyPixel/editor/pull/820) [`8d33c94`](https://github.com/JollyPixel/editor/commit/8d33c9415c21955b94f3c294ceb347f733534787) Thanks [@fraxken](https://github.com/fraxken)! - `WebsocketTransport` can negotiate permessage-deflate (`compression`), and servers can send a `"correction"` that `CommandSync` applies before the client's later changes.

- [#823](https://github.com/JollyPixel/editor/pull/823) [`1bbae1c`](https://github.com/JollyPixel/editor/commit/1bbae1ceddffa7431cbe9c711d41a3c401a5dc93) Thanks [@fraxken](https://github.com/fraxken)! - Clients reconnect with backoff and resume their rooms where they left off, rebasing pending local changes. Voxel layers are addressed by `layerId` (world format v4).

- [#802](https://github.com/JollyPixel/editor/pull/802) [`5d415e4`](https://github.com/JollyPixel/editor/commit/5d415e4f680fd90ba0ec3819b018baa5c59382fe) Thanks [@fraxken](https://github.com/fraxken)! - Asset rooms resend a snapshot to the author of a refused command, and `CommandSync` adds `whenReady()`. `PixelDocument` emits `buffer-updated`.

- [#788](https://github.com/JollyPixel/editor/pull/788) [`4a6ffd0`](https://github.com/JollyPixel/editor/commit/4a6ffd0841535389f5c61246cbf8d5b45d9f408e) Thanks [@fraxken](https://github.com/fraxken)! - Add `SchemaParser`, which checks a value against one JSON Schema and returns a typed `Result`. It is exported from the package root.

### Patch Changes

- [#841](https://github.com/JollyPixel/editor/pull/841) [`71d300a`](https://github.com/JollyPixel/editor/commit/71d300a76e87200b52cb4a1e9394ce22793c2a8a) Thanks [@fraxken](https://github.com/fraxken)! - Add `suspendWhenHidden` to pause the loop while the page is hidden. `load({ maxFps })` skips GPU benchmarking.

## 4.0.0

### Major Changes

- [#743](https://github.com/JollyPixel/editor/pull/743) [`6321913`](https://github.com/JollyPixel/editor/commit/632191387a3708bbefaebfc8f59bf0c105c4f242) Thanks [@fraxken](https://github.com/fraxken)! - Move password authentication and worker proxies to `network/node`; register workers as extension instances.
  Support browser timers and snapshot mutable asset inputs before asynchronous writes.

### Minor Changes

- [#760](https://github.com/JollyPixel/editor/pull/760) [`8d2c08f`](https://github.com/JollyPixel/editor/commit/8d2c08f484a8ab7b1ef055c6d45c8267f7c6fc6d) Thanks [@fraxken](https://github.com/fraxken)! - Add `ChannelTransport` and `ChannelTransportHost` (`@jolly-pixel/network/transport/channel.ts`) to relay client connections over a `BroadcastChannel`, `MessagePort` or worker.

- [#743](https://github.com/JollyPixel/editor/pull/743) [`6321913`](https://github.com/JollyPixel/editor/commit/632191387a3708bbefaebfc8f59bf0c105c4f242) Thanks [@fraxken](https://github.com/fraxken)! - The asset backend can run inside a browser page through `LoopbackTransport`. Content hashing uses WebCrypto, so `writeData()` is async.

## 3.0.0

### Major Changes

- [#639](https://github.com/JollyPixel/editor/pull/639) [`55a1230`](https://github.com/JollyPixel/editor/commit/55a12309b7e3d4a3c7ba7efc47766655abaf10f9) Thanks [@fraxken](https://github.com/fraxken)! - Authenticate connections at the WebSocket handshake through an `AuthenticationProvider`. The client's `identity` becomes the untrusted `profile`, and roles missing from a rights table are denied.

- [#662](https://github.com/JollyPixel/editor/pull/662) [`ae6293b`](https://github.com/JollyPixel/editor/commit/ae6293bf83ef24d0e91569994594a87221577ea2) Thanks [@fraxken](https://github.com/fraxken)! - Remove the event store from `@jolly-pixel/network`; asset rooms take an event writer through `registerAssetRooms({ events })`.

- [#664](https://github.com/JollyPixel/editor/pull/664) [`271fba9`](https://github.com/JollyPixel/editor/commit/271fba955fe79253b972a13daf0419a696138788) Thanks [@fraxken](https://github.com/fraxken)! - Replace `SyncAdapter` with `CommandSync` and add `PresenceChannel`; presence set before `join()` travels with the join.

### Minor Changes

- [#659](https://github.com/JollyPixel/editor/pull/659) [`d61e341`](https://github.com/JollyPixel/editor/commit/d61e341ffbe1f555237cf0b586d628bf5c94c82f) Thanks [@fraxken](https://github.com/fraxken)! - The catalog room accepts create, rename and delete commands, and rooms of deleted assets announce the deletion. `AssetWriter` returns failures as results instead of throwing.

## 2.0.0

### Major Changes

- [#623](https://github.com/JollyPixel/editor/pull/623) [`02b3b44`](https://github.com/JollyPixel/editor/commit/02b3b44814abf14c24bfea237afababa6ff8b09c) Thanks [@fraxken](https://github.com/fraxken)! - Messages are parsed with JSON Schema: extensions declare `protocols` instead of `events` and `getEventName`. Fixes rights filtering on broadcasts.

### Minor Changes

- [#528](https://github.com/JollyPixel/editor/pull/528) [`d6f6a22`](https://github.com/JollyPixel/editor/commit/d6f6a22e8d9a5644b1e27622aa00d5e1af594702) Thanks [@fraxken](https://github.com/fraxken)! - Cut editor boot time by stopping the client from re-uploading its whole
  placeholder atlas on every load, resuming asset replay from the last snapshot
  checkpoint, and letting rooms resolve without blocking one another.

- [#571](https://github.com/JollyPixel/editor/pull/571) [`c9fa209`](https://github.com/JollyPixel/editor/commit/c9fa2090fc08b3151f107290459dbd050a584186) Thanks [@fraxken](https://github.com/fraxken)! - `Mouse.hovering` tells whether the pointer is over the canvas. Peer voxel edits reach local observers.

- [#628](https://github.com/JollyPixel/editor/pull/628) [`423db10`](https://github.com/JollyPixel/editor/commit/423db105df46e6ec7bb692beec0a37b1f9332fad) Thanks [@fraxken](https://github.com/fraxken)! - The extension hooks `onClientConnect`, `onClientDisconnect` and `onMessage` are optional; implementations need the `override` modifier.

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
