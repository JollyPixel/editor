# @jolly-pixel/asset-server

## 7.0.0

### Major Changes

- [#1102](https://github.com/JollyPixel/editor/pull/1102) [`19e8fb2`](https://github.com/JollyPixel/editor/commit/19e8fb24034a423e62b3ac9e2021b834984de0e9) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - `AssetTags` takes `kinds`, and a tag backup stores each part at its part file path. Every asset room reserves `subscribe-parts` and `unsubscribe-parts`, and a tag room subscribes each member to every part.
  `parts.list` reads the manifest bytes instead of a state, so writes no longer load the manifest. Add `partRequests()` to split a part request into messages the room accepts.

- [#1128](https://github.com/JollyPixel/editor/pull/1128) [`75493f9`](https://github.com/JollyPixel/editor/commit/75493f9032176bfa25b4758b867c22f5b36c872f) Thanks [@fraxken](https://github.com/fraxken)! - Follow the async event store: `AssetTags.list`, `read` and `delete` return promises, and `LiveAssetRoom.connect`, `receive` and `resync` must be awaited.
  `foldAssetEvent` takes the held part contents from the new `heldPartRefs()` and `loadHeldParts()` instead of an event reader, and asset rooms handle one command at a time.

### Minor Changes

- [#1114](https://github.com/JollyPixel/editor/pull/1114) [`fa742ce`](https://github.com/JollyPixel/editor/commit/fa742ceefc37a374ee60e6638ed3c0a8f1d06539) Thanks [@fraxken](https://github.com/fraxken)! - Add `JsonAssetFile` (JSON file codec that reports bad content as `InvalidAssetFileError`), `JSON_CONTENT_TYPE`, `SNAPSHOT_OPTIONS_SCHEMA` and `arbitrated(state, rules)`, which wires a `KeyedCommandArbiter` into an asset kind's live protocol.

- [#1109](https://github.com/JollyPixel/editor/pull/1109) [`d36f467`](https://github.com/JollyPixel/editor/commit/d36f46702ac084e4305eca2114d19de84b7ea4e7) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Add the `catalog:replace` command and `CatalogClient.replace(assetId, content, { from })`: new content for an existing asset, keeping its ID and path.
  The overwritten content gets a `restore/<eventVersion>` restore point, and open rooms reload the new content.

- [#1111](https://github.com/JollyPixel/editor/pull/1111) [`f17d58f`](https://github.com/JollyPixel/editor/commit/f17d58f00807c0dd3bf6404e07bcc5b74a6cd7ab) Thanks [@fraxken](https://github.com/fraxken)! - Add `createProjectContributionsPlugin`, which serves `virtual:jolly-pixel/contributions/<field>`: the export subpath that each project package names under `jollypixel.<field>` in its manifest.

- [#1103](https://github.com/JollyPixel/editor/pull/1103) [`293b03d`](https://github.com/JollyPixel/editor/commit/293b03d92636ee1b7a31531635ebea69e398520d) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - The built-in `texture` kind opens a read-only live room whose snapshot is the image file as `AssetInlineContent`; it accepts no command. Add `TEXTURE_ASSET`, a descriptor to list textures in asset pickers.

### Patch Changes

- [#1131](https://github.com/JollyPixel/editor/pull/1131) [`7bfe12b`](https://github.com/JollyPixel/editor/commit/7bfe12b6c35e5b074c5a9109d1f97048856b6470) Thanks [@fraxken](https://github.com/fraxken)! - `catalog:create` now rejects content its asset kind cannot load, before anything is written.
- Updated dependencies [[`75493f9`](https://github.com/JollyPixel/editor/commit/75493f9032176bfa25b4758b867c22f5b36c872f), [`c1a8763`](https://github.com/JollyPixel/editor/commit/c1a87634da5e6c17e86fc3a1f9fcec587d9a5f64)]:
  - @jolly-pixel/event-store@6.0.0
  - @jolly-pixel/network@7.0.0

## 6.0.0

### Major Changes

- [#859](https://github.com/JollyPixel/editor/pull/859) [`425cef9`](https://github.com/JollyPixel/editor/commit/425cef984d0c6e5bf06f99fa29e0282acb47350b) Thanks [@fraxken](https://github.com/fraxken)! - `AssetSource` gains `folders()`, `createFolder` and `deleteFolder`, so empty folders persist, plus `FolderSet`; `watch` callbacks also receive whether a file or a folder changed.
  The catalog room lists folders through `CatalogFolders` (`backend.folders`), with `catalog:create-folder`, `catalog:move-folder`, `catalog:delete-folder` and `catalog:folders`; `CatalogClient` adds `folders()`, `createFolder`, `moveFolder` and `removeFolder`.

- [#1071](https://github.com/JollyPixel/editor/pull/1071) [`32d05ac`](https://github.com/JollyPixel/editor/commit/32d05acf969fc7b09067ffcda2fcea0e6191fbcd) Thanks [@fraxken](https://github.com/fraxken)! - Add `AssetKind` and `AssetPath` (replaces `AssetSource`). Records carry `path` instead of `source` in `AssetRecord`, `AssetRecordData` and the catalog protocol, and a kind may no longer contain `@`.
  `AssetReference.equals` compares `AssetType` tokens, `AssetCoordinator.catalog`/`loaders` are private, and `evict()` takes a reference and returns its typed value.

- [#863](https://github.com/JollyPixel/editor/pull/863) [`6adf788`](https://github.com/JollyPixel/editor/commit/6adf788e94caa25e8550d3eed89e3720e52ab0fc) Thanks [@fraxken](https://github.com/fraxken)! - `CatalogProjection` now indexes an `AssetProjector` (`{ projector }`), `backend.internals` is replaced by `backend.reconcile()`, `AssetStateStore.serialize()` is removed, and `exportAssetArchive` returns a `Result` with `UnknownAssetError` for an unknown root.
  Live commands extend `AssetCommandHeader`, `broadcast` returns an `AssetBroadcast`, catalog protocol types derive from their schemas, and `builtInAssetKinds()` and `AssetKindRegistry.decode()` are added.

- [#1052](https://github.com/JollyPixel/editor/pull/1052) [`7e1b38c`](https://github.com/JollyPixel/editor/commit/7e1b38cc30b4c44336b4cf2caee67fb586301e6a) Thanks [@fraxken](https://github.com/fraxken)! - Rename `createAssetWorkspace` to `AssetServer.open`, whose network server is `assetServer.network`, and `createAssetWorkspacePlugin` to `createAssetServerPlugin`.

- [#1070](https://github.com/JollyPixel/editor/pull/1070) [`29ed99a`](https://github.com/JollyPixel/editor/commit/29ed99a3f4d2a5892c4c7f56721109bff3563fb1) Thanks [@fraxken](https://github.com/fraxken)! - Rename the state path exports `IDENTITY_SIDECAR_PATH` to `ASSET_INDEX_PATH` and `CONTENT_OBJECTS_PATH` to `BACKUP_OBJECTS_PATH`; the files on disk keep their paths.
  Group the backend options into `catalog`, `reconcile` and `compaction` (for example `catalogMaxContentBytes` is now `catalog.maxContentBytes` and `watch` is `reconcile.watch`); `compaction.onSnapshot` defaults to `compaction.onOpen`.
  Remove `AssetServerOptions.compactOnOpen` in favor of `backend.compaction.onOpen`, still on by default. A backend that fails to open now closes what it had started.

- [#1078](https://github.com/JollyPixel/editor/pull/1078) [`89073fc`](https://github.com/JollyPixel/editor/commit/89073fcf9c2ca0fa9ff2f1b5c00746c95544e47e) Thanks [@fraxken](https://github.com/fraxken)! - `AssetWriter` now requires a `source` option. Asset create, rename and import, and the catalog create-folder and move-folder commands, refuse a path the source ignores (`.git/`, `node_modules/`, `dist/` and custom globs) with a `reserved` `AssetPathEscapeError`.
  Before, a catalog client could write files there, such as a git hook or a kind package the server imports.

- [#879](https://github.com/JollyPixel/editor/pull/879) [`f071e53`](https://github.com/JollyPixel/editor/commit/f071e53e866a18c6bb0adc86f996f22e14787e70) Thanks [@fraxken](https://github.com/fraxken)! - `catalog:rename` and `catalog:delete` take only a `renames` or `assetIds` list, applied in order up to the first refused entry and answered with `{ applied, failure? }`; `CatalogClient` adds `renameMany` and `removeMany`.
  `catalog:changed` now carries a `changes` list, and the changes of a list command reach members in one message.

- [#1069](https://github.com/JollyPixel/editor/pull/1069) [`176b005`](https://github.com/JollyPixel/editor/commit/176b005c86d6d2e62e6d03780d26cf6f770e2650) Thanks [@fraxken](https://github.com/fraxken)! - Rename `CommandDocumentKind.createDocument(room)` to `syncDocument(room)` (now an alias of the new `DocumentKind`), `InvalidAssetDocumentError` to `InvalidAssetFileError` and `ProjectFile.document` to `ProjectFile.data`.
  Rename the `.pixelart` codec to `PixelArtFile` (`create/parse/encode/decodePixelArtFile`, `InvalidPixelArtFileError`, `PIXEL_ART_FILE_VERSION`) and `DocumentCommand` to `PixelDocumentCommand`.

- [#1024](https://github.com/JollyPixel/editor/pull/1024) [`9123c45`](https://github.com/JollyPixel/editor/commit/9123c4578d791cb8f9d3749e56d2c8268ee87ec7) Thanks [@fraxken](https://github.com/fraxken)! - Rename methods named `xOf`, `xFor` or `getX`/`setX` after what they do (for example `inverseOf` → `invert`, `UVRegion.rectFor` → `slotRect`, `MessageParser.of` → `fromProtocol`).
  The package docs list the new names; behavior is unchanged.

- [#1022](https://github.com/JollyPixel/editor/pull/1022) [`1a9db4f`](https://github.com/JollyPixel/editor/commit/1a9db4f0e48b42c9f23e302e117f24fcd1211e66) Thanks [@fraxken](https://github.com/fraxken)! - Schemas are written with zod instead of JSON Schema (`defineSchema` and `JSONSchema` are removed): Node validates them with ata-validator, browsers with zod. `withEvent` names a variant's event, `minProperties`/`dependentRequired`/`requiredAnyOf`/`notMultipleOf` cover rules zod cannot emit, and `ValidationError` keeps `instancePath` and `message` only.
  Kind packages export a zod `optionsSchema`, and `ServerOptions.validateOutbound: false` names outbound messages from their tags without validating them.

### Minor Changes

- [#1034](https://github.com/JollyPixel/editor/pull/1034) [`5c9d715`](https://github.com/JollyPixel/editor/commit/5c9d7156f236fd7a2b3acae3c0a7c6f4ba6c8dd2) Thanks [@fraxken](https://github.com/fraxken)! - `createAssetBackend` accepts `compactOnOpen`, which `AssetServer.open` now forwards instead of compacting itself.
  The backend ignores a stored `state.json` when its event log is empty, so checkpoints from a lost log no longer hide new events.

- [#971](https://github.com/JollyPixel/editor/pull/971) [`bb6bbcc`](https://github.com/JollyPixel/editor/commit/bb6bbcc2e5e5fde1d9ab9d9ed88c8b009db583ae) Thanks [@fraxken](https://github.com/fraxken)! - Add `AssetKindHandler.conversions`: a catalog create with `from` (an extension such as `".png"`) converts the content into the kind's format before writing it.
  `KindPackage.descriptors` returns `LoadedAssetKind`, which lists those extensions as `convertsFrom`; `from` requires content.

- [#1072](https://github.com/JollyPixel/editor/pull/1072) [`8406e0f`](https://github.com/JollyPixel/editor/commit/8406e0f1ad3f4f34f988e62c00c7da35e51f5396) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Add asset parts: a kind may declare `parts` to store its content as a manifest and part files in `<asset>.parts/`, checkpointed one generation per `asset.updated`.
  Tags, archives and seeding carry the parts, and a live room streams them: `live().parts` answers `subscribe-parts` and filters each command's broadcast, and a tag room sends every part. `CatalogFolders` takes `kinds`; `compact` takes `keep`.

- [#865](https://github.com/JollyPixel/editor/pull/865) [`35f9459`](https://github.com/JollyPixel/editor/commit/35f94598ed00f46dfd07152c752f8604d6ce436f) Thanks [@fraxken](https://github.com/fraxken)! - `AssetRoomExtension.onMessage` takes the command the network server already validated and no longer parses it a second time.
  `CatalogClient.toSnapshot()` returns its current state as a `catalog:snapshot` message.

- [#969](https://github.com/JollyPixel/editor/pull/969) [`8401f8e`](https://github.com/JollyPixel/editor/commit/8401f8e43817c0d11b41da8d1d2d85377b007093) Thanks [@fraxken](https://github.com/fraxken)! - Add `inMemory` to `AssetServer.open` and `createAssetServerPlugin` for an in-memory source and event log, and `ProjectFile.inMemory`, which `createProjectFileWatchPlugin` uses to skip a file kept in memory.

- [#857](https://github.com/JollyPixel/editor/pull/857) [`bf73b63`](https://github.com/JollyPixel/editor/commit/bf73b63a919ab87d1f6824754b07133e38b4719e) Thanks [@fraxken](https://github.com/fraxken)! - Add `ProjectFile`, `ProjectKinds` and `KindPackage` to load the kind packages a project lists in `.jollypixel/project.json`, checking their options against each package's `optionsSchema`.
  Add the `AssetKindPackage` type kind packages export as `ASSET_KINDS`, and `SNAPSHOT_POLICY_SCHEMA`.
  Add `PackageResolver` to resolve kind packages from the project root, fallbacks or local folders, `createProjectKindsPlugin` serving their handlers to browser code, and `createProjectFileWatchPlugin` restarting the dev server when the project file changes.

- [#928](https://github.com/JollyPixel/editor/pull/928) [`c86b214`](https://github.com/JollyPixel/editor/commit/c86b214c710a64428fa251465f3bcd7984471a36) Thanks [@fraxken](https://github.com/fraxken)! - `AssetBackendOptions.stateIgnores` adds host entries to the state directory's `.gitignore`.

- [#962](https://github.com/JollyPixel/editor/pull/962) [`7bdb4dd`](https://github.com/JollyPixel/editor/commit/7bdb4ddbdb0eed8c2882ece4a3911fe43b9cc436) Thanks [@fraxken](https://github.com/fraxken)! - Add asset tags: `backend.tags` creates, lists, restores and deletes them, and the catalog room and `CatalogClient` expose the same calls.
  Tagged content and external edits the projector would overwrite are backed up in `.jollypixel/objects/`.

- [#867](https://github.com/JollyPixel/editor/pull/867) [`f03cb7a`](https://github.com/JollyPixel/editor/commit/f03cb7a89b574ba6965f3b88d0ad5796de6cbdce) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Open asset rooms broadcast a fresh snapshot when their content is replaced from outside (`AssetStateStore` emits `replaced`), and `peerPresence.uvSelections` outlines each peer's selected UV region below the local selection.
  Truncated `@jolly-pixel/ui` labels show their full text on hover (`overflow-title="off"` disables it), `jolly-pane-group` tabs collapse to their icon when the strip is too narrow, and `jolly-tree` takes `swatch-position="start"`.

- [#951](https://github.com/JollyPixel/editor/pull/951) [`86af3d5`](https://github.com/JollyPixel/editor/commit/86af3d5b5e2fcc0ca9db56460add568776bde5eb) Thanks [@fraxken](https://github.com/fraxken)! - KTX2 textures: `TextureAssetLoader` and `createDefaultAssetLoaders` take a `ktx2` loader for `.ktx2` sources, and `Runtime` builds one from `assets.ktx2.transcoderPath`.
  The `texture` asset kind claims `.ktx2`, served as `image/ktx2`; `loadBlocksets` accepts a `KTX2Loader`, and `AtlasTexture` includes `THREE.CompressedTexture`.

- [#922](https://github.com/JollyPixel/editor/pull/922) [`12dca6e`](https://github.com/JollyPixel/editor/commit/12dca6e98be8b71f9ef8517edcc17d8e8520fb72) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Add `CommandHistory`: per-person undo and redo over `CommandDocument`s, synced by `DocumentSyncClient` and owned by `SyncedCommandDocument`, refusing a step a peer changed since.
  Resyncs carry `refused` and `CommandSync` emits `"refused"` on rollback; `ChangeReceipts` carries the server's answers about local changes.
  `jolly-tree` takes `validateRename` to refuse a rename, and `TreeNode.warning` flags a row with a warning icon.

- [#869](https://github.com/JollyPixel/editor/pull/869) [`e646731`](https://github.com/JollyPixel/editor/commit/e646731d6968af9a58604f5b503950e73dfa9681) Thanks [@fraxken](https://github.com/fraxken)! - event-store adds `expectedVersion` appends (`EventVersionConflictError`) and per-asset `compact` (`assetId`); SQLite files open in WAL mode with incremental vacuum.
  asset-server snapshots no longer reload live state or drop commands appended while serializing, compacts before snapshots (`compactOnSnapshot`), caches room snapshots per version and reconciles only changed paths; `watch` reports readiness through `onReady` and skips initial and temporary entries.
  network room loggers no longer overwrite the shared logger context, and disabled debug logs skip building metadata.

- [#963](https://github.com/JollyPixel/editor/pull/963) [`f20007a`](https://github.com/JollyPixel/editor/commit/f20007a1717a9b9bbab779489156c36451be38a0) Thanks [@fraxken](https://github.com/fraxken)! - Add view-only share links: `accounts.shareLinks` stores expiring link tokens that `authenticate` resolves to a `GUEST_ROLE` identity, and the `Server` option `admits` limits that identity to some rooms.
  `CatalogViewExtension` serves a read-only catalog scoped to one asset's dependency closure (`CatalogClient.connect(client, { room })`), `launchElement` injects the launch, and `createAssetServerPlugin({ http: false })` drops the unauthenticated HTTP routes.
  `PresencePeer.badge` shows "via link" for guests.

- [#1045](https://github.com/JollyPixel/editor/pull/1045) [`695ee81`](https://github.com/JollyPixel/editor/commit/695ee81072bd90cae25c03e5e850ce214153278b) Thanks [@fraxken](https://github.com/fraxken)! - Settings change without a restart: `Server.replaceRights`, kind options via `ProjectFile.replace`, `KindPackage.withOptions` and `ProjectKinds`/`AssetKindRegistry.replace`, and `Accounts.replaceRoles`/`replaceAccessRequests`; `RightsPattern` is exported.
  Accounts store per-account `preferences` and report typed `AccountActivity` events; `listAll` pages newest first with `beforeEventId`.
  `OrbitFlyCamera` gains `invertY` and a `touchpadSwipe` look or pan mode.

- [#977](https://github.com/JollyPixel/editor/pull/977) [`6b9daee`](https://github.com/JollyPixel/editor/commit/6b9daee5304c6bf06fd77086633e682d35640afc) Thanks [@fraxken](https://github.com/fraxken)! - Tag rooms: `AssetRoom` takes an optional `tag` (`kind@tag:assetId`), and the asset-server resolves such a room read-only with the tagged content through `AssetTags.read()`.
  Network `RoomResolution.readOnly` caps every message right of a resolved room at `read`, and `RightsGate.configured` becomes `gated`; `TagName` (with `isRestorePoint`) and `InvalidTagNameError` are exported from `@jolly-pixel/asset-server/client`.

- [#1039](https://github.com/JollyPixel/editor/pull/1039) [`33f6b2f`](https://github.com/JollyPixel/editor/commit/33f6b2f3a7c5ced091a3500480fbd2160f5ffcc0) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - `AssetLiveProtocol` gains an optional `relay` for ephemeral client messages outside arbitration and the event log; a live room that fails to open releases its state.
  `OrbitFlyCamera.teleport()` keeps the camera at the pose in "elastic" focus mode and releases a "lock" orbit, instead of being pulled back on the next frame.

- [#1048](https://github.com/JollyPixel/editor/pull/1048) [`e1e86cb`](https://github.com/JollyPixel/editor/commit/e1e86cb232b5e021d839a58b8b68013194308349) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Relay schemas move to `AssetCommands.relay`, checked when `registerAssetRooms` starts; handler APIs return `AnyAssetKindHandler`, and `@jolly-pixel/asset-server/testing` adds `LiveAssetRoom` and `mockAssetRoom`.
  Add `KeyedCommandArbiter` and `commandDocumentKind` to `@jolly-pixel/network`; breaking: `SyncedCommandDocument` now takes `<TDocument, TNotice>`.
  Add `SceneManager.unloadScene(scene)` to `@jolly-pixel/engine`.

### Patch Changes

- [#1021](https://github.com/JollyPixel/editor/pull/1021) [`334fb9b`](https://github.com/JollyPixel/editor/commit/334fb9b31baf67b797f0f9564ac4f6be2c689e11) Thanks [@fraxken](https://github.com/fraxken)! - Cache the catalog join snapshot and HTTP body per catalog revision, defer projection state saves of single-asset flushes by up to a second, and drop per-command allocations on asset room edits.
  A room validates and serializes a frozen outbound payload once and reuses it. The sqlite append no longer scans the asset's whole history to find its next version.

- [#1019](https://github.com/JollyPixel/editor/pull/1019) [`e91817e`](https://github.com/JollyPixel/editor/commit/e91817e4dc21e0f659340de5ab426cdec4d45067) Thanks [@fraxken](https://github.com/fraxken)! - Update ata-validator to 1.53.0 and recompile the envelope validators.
  A protocol that declares no message now rejects payloads without running the union validator.

- [#1016](https://github.com/JollyPixel/editor/pull/1016) [`5df8953`](https://github.com/JollyPixel/editor/commit/5df89531ef26fe891a7ef5ed6144ea8dc2155bee) Thanks [@fraxken](https://github.com/fraxken)! - `encodePng` takes an optional `{ filter }`: `"adaptive"` (the default) or one fixed PNG row filter. `encodePngPixels` uses `"none"`: a 1024x512 tileset snapshot drops from about 165 KB to 95 KB.
  pixel-draw.renderer and asset-server decode and encode base64 natively (`Uint8Array.fromBase64`, `Buffer`, then `atob`) and drop `js-base64`.

- [#933](https://github.com/JollyPixel/editor/pull/933) [`02172bd`](https://github.com/JollyPixel/editor/commit/02172bd0a88a1db4612b76a41d78e424517f5ba0) Thanks [@fraxken](https://github.com/fraxken)! - A rights table now denies unmatched keys; end a role with `"*": "write"` to keep it open. `WebsocketTransport` checks Host and Origin headers, caps payloads, terminates slow or silent sockets, and no longer crashes when a client resets during authentication.
  `PasswordAuthentication` limits failed attempts per address, `ServerOptions.limits` bounds presence size and resync rate, and `attributeCommand` stamps command headers on the server.

- [#1051](https://github.com/JollyPixel/editor/pull/1051) [`8323f7d`](https://github.com/JollyPixel/editor/commit/8323f7d1ac6ccb05c46407561cccf13a85098285) Thanks [@fraxken](https://github.com/fraxken)! - Drop `serverMessageProtocol`, `attributeCommand`, `ConflictTracker` and the `ConflictResolver` option; `CommandSync` requires a `reconciler` and makes `sendChange` public.
  `KeyedCommandArbiter` takes `writes` (scoped keys or a reset) plus an optional `narrow`; new `SyncedDocument` base class.
- Updated dependencies [[`425cef9`](https://github.com/JollyPixel/editor/commit/425cef984d0c6e5bf06f99fa29e0282acb47350b), [`32d05ac`](https://github.com/JollyPixel/editor/commit/32d05acf969fc7b09067ffcda2fcea0e6191fbcd), [`8406e0f`](https://github.com/JollyPixel/editor/commit/8406e0f1ad3f4f34f988e62c00c7da35e51f5396), [`334fb9b`](https://github.com/JollyPixel/editor/commit/334fb9b31baf67b797f0f9564ac4f6be2c689e11), [`8539d87`](https://github.com/JollyPixel/editor/commit/8539d8702d62c6b27ade0f1e0bb13134b20e90fe), [`89073fc`](https://github.com/JollyPixel/editor/commit/89073fcf9c2ca0fa9ff2f1b5c00746c95544e47e), [`e91817e`](https://github.com/JollyPixel/editor/commit/e91817e4dc21e0f659340de5ab426cdec4d45067), [`35f9459`](https://github.com/JollyPixel/editor/commit/35f94598ed00f46dfd07152c752f8604d6ce436f), [`5af5621`](https://github.com/JollyPixel/editor/commit/5af5621e4223fb97ab38b22530a64c0884d52051), [`176b005`](https://github.com/JollyPixel/editor/commit/176b005c86d6d2e62e6d03780d26cf6f770e2650), [`c9726dc`](https://github.com/JollyPixel/editor/commit/c9726dc516927b5d119e066e7dfa0a1bca536eaf), [`5c9d715`](https://github.com/JollyPixel/editor/commit/5c9d7156f236fd7a2b3acae3c0a7c6f4ba6c8dd2), [`e330bb1`](https://github.com/JollyPixel/editor/commit/e330bb166a520f7dd4ae7cf4c0837bf721c7bb90), [`7bdb4dd`](https://github.com/JollyPixel/editor/commit/7bdb4ddbdb0eed8c2882ece4a3911fe43b9cc436), [`f174add`](https://github.com/JollyPixel/editor/commit/f174addea4b885bd601976b7fd730a91a0b047c4), [`59fc78a`](https://github.com/JollyPixel/editor/commit/59fc78a35178c8a5eee14462eb8b27ace71d1e22), [`9123c45`](https://github.com/JollyPixel/editor/commit/9123c4578d791cb8f9d3749e56d2c8268ee87ec7), [`86af3d5`](https://github.com/JollyPixel/editor/commit/86af3d5b5e2fcc0ca9db56460add568776bde5eb), [`ef2c7fe`](https://github.com/JollyPixel/editor/commit/ef2c7fe37e1d532b745e6462c26bb9f650ccc875), [`12dca6e`](https://github.com/JollyPixel/editor/commit/12dca6e98be8b71f9ef8517edcc17d8e8520fb72), [`c141b45`](https://github.com/JollyPixel/editor/commit/c141b453ebd7191ee44bd98b74825e8b9570264e), [`02172bd`](https://github.com/JollyPixel/editor/commit/02172bd0a88a1db4612b76a41d78e424517f5ba0), [`9bcc044`](https://github.com/JollyPixel/editor/commit/9bcc044e1feaaed69f3344d17bff5b7e7f3ea797), [`c86b214`](https://github.com/JollyPixel/editor/commit/c86b214c710a64428fa251465f3bcd7984471a36), [`85641f5`](https://github.com/JollyPixel/editor/commit/85641f5459de96c87aea28ae1ec5ef564991a760), [`40e16a4`](https://github.com/JollyPixel/editor/commit/40e16a4ae92fdb94931b59e9ba80af52330b1bc4), [`27cff63`](https://github.com/JollyPixel/editor/commit/27cff63c507ae72b62c0299999590c839f2ac492), [`28dae7b`](https://github.com/JollyPixel/editor/commit/28dae7b8ef17f600128ba02cfe33436afadf1c92), [`5fbedf2`](https://github.com/JollyPixel/editor/commit/5fbedf27124e3deb38992f3b70592b9536d9223c), [`8323f7d`](https://github.com/JollyPixel/editor/commit/8323f7d1ac6ccb05c46407561cccf13a85098285), [`13c7153`](https://github.com/JollyPixel/editor/commit/13c7153fcd2cfded9e0f9be6536e0aae8440ba19), [`3d53ea9`](https://github.com/JollyPixel/editor/commit/3d53ea9ae1d62eed99cde3dd80a1c8831deedffb), [`a75ee6d`](https://github.com/JollyPixel/editor/commit/a75ee6dc5ef94c274f0f3b69d8eeff73e018e495), [`e646731`](https://github.com/JollyPixel/editor/commit/e646731d6968af9a58604f5b503950e73dfa9681), [`a1c9713`](https://github.com/JollyPixel/editor/commit/a1c9713eafcdf644030bd565c4e119b84e3cfea8), [`f20007a`](https://github.com/JollyPixel/editor/commit/f20007a1717a9b9bbab779489156c36451be38a0), [`695ee81`](https://github.com/JollyPixel/editor/commit/695ee81072bd90cae25c03e5e850ce214153278b), [`6b9daee`](https://github.com/JollyPixel/editor/commit/6b9daee5304c6bf06fd77086633e682d35640afc), [`e1e86cb`](https://github.com/JollyPixel/editor/commit/e1e86cb232b5e021d839a58b8b68013194308349), [`75902c5`](https://github.com/JollyPixel/editor/commit/75902c51ba6fb64d72d322e9bc73a80e8dcfbce2), [`1a9db4f`](https://github.com/JollyPixel/editor/commit/1a9db4f0e48b42c9f23e302e117f24fcd1211e66)]:
  - @jolly-pixel/asset-source@4.0.0
  - @jolly-pixel/asset@4.0.0
  - @jolly-pixel/event-store@5.0.0
  - @jolly-pixel/network@6.0.0

## 5.0.0

### Major Changes

- [#782](https://github.com/JollyPixel/editor/pull/782) [`5d64074`](https://github.com/JollyPixel/editor/commit/5d64074fca7103b22c62c1d652baf8e09618e3c4) Thanks [@fraxken](https://github.com/fraxken)! - Add the `catalogArchiveLimits` back-end option (`archiveLimits` on `CatalogExtension`) to set the decoded entry and archive caps of catalog imports.
  `readAssetArchive` takes `ArchiveLimits`, which replaces `ReadAssetArchiveOptions`; `./client` now exports it with `DEFAULT_ARCHIVE_MAX_*`, and the root exports `AssetBackendTuning`.

- [#781](https://github.com/JollyPixel/editor/pull/781) [`20c529d`](https://github.com/JollyPixel/editor/commit/20c529d199eb0e5a7430c99003872398a065604e) Thanks [@fraxken](https://github.com/fraxken)! - The asset static handler and the catalog handler are built on `@openally/servo`: content ETags with `304`, `Cache-Control: no-cache`, `nosniff`, and byte ranges for assets.
  `safeAssetPath` now rejects a Windows reserved segment (`:`, trailing dot or space, device name) as `reserved`, so writes, archive imports and every source refuse it, and asset URLs answer `403`.

- [#777](https://github.com/JollyPixel/editor/pull/777) [`d621be0`](https://github.com/JollyPixel/editor/commit/d621be08881b0fc979a7971ecf3712808bb834e5) Thanks [@fraxken](https://github.com/fraxken)! - Catalog API reshaped: `CatalogProjection`/`CatalogClient` expose `dependencies` (read-only `DependencyIndex`) and `dependentsOf` returns live records; `CatalogExtension` takes one `backend`; `CatalogClient.connect()` replaces `catalogRoom()`.
  `requestId` is required on catalog commands and replies; `CatalogSessionArchive` and `ArchiveImportDisabledError` moved to editor.host.

- [#789](https://github.com/JollyPixel/editor/pull/789) [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285) Thanks [@fraxken](https://github.com/fraxken)! - Subpaths follow one naming scheme: `network/node` (now with the Vite plugin), `asset-server/{client,node}`, `asset-source/node`, `event-store/node` (was `./sqlite`), `image/browser` and `voxel.renderer/engine` (the Rapier plugin joins the root). `.ts` keys, wildcards, `network/parser` and `network/transport/*` are removed; transports ship from the network root, `./client` and `./node`.
  The `asset-server` and `asset-source` roots are now browser-safe and absorb `./backend`, `./kinds`, `./core` and `./indexeddb`; Node-only code moves to `./node`.
  Every published package declares `exports` instead of `main`/`types`, and the packages with no import-time side effects declare `"sideEffects": false`.

### Minor Changes

- [#796](https://github.com/JollyPixel/editor/pull/796) [`0db872e`](https://github.com/JollyPixel/editor/commit/0db872e6e3567a4a0deca4ad6bda0b30d3b643c9) Thanks [@fraxken](https://github.com/fraxken)! - `AssetCatalog` gains `find()` and `set()`; `replace()`, `firstOfKind()`, the `fetch`/`text`/`sourceUrl` helpers, `assetSourceUrl`, `AssetKindNotFoundError` and `AssetFetchError` are removed. `parse()` methods validate with zod and throw `ZodError`, and kinds reject a colon everywhere.
  `AssetStore` is internal: `AssetCoordinator.evict()` replaces `coordinator.store`, requests no longer create entries, and `loadBatch()` accepts `signal`. `LAUNCH_ELEMENT_ID` moves to `@jolly-pixel/asset-server`.

- [#820](https://github.com/JollyPixel/editor/pull/820) [`8d33c94`](https://github.com/JollyPixel/editor/commit/8d33c9415c21955b94f3c294ceb347f733534787) Thanks [@fraxken](https://github.com/fraxken)! - `AssetLiveProtocol` gains an optional `correct(command, admitted)`. When it returns a command, a refused or narrowed edit resyncs its author with a `correction` instead of a full snapshot.

- [#773](https://github.com/JollyPixel/editor/pull/773) [`3297510`](https://github.com/JollyPixel/editor/commit/3297510657a51f74aa04c24c64274bae3f7d885b) Thanks [@fraxken](https://github.com/fraxken)! - Make `content` optional on a seed entry: `seedAssetSource` takes `handlers` and writes the serialized `create(id)` state of the entry's kind instead.
  Add the `AssetKindDescriptor` type, a kind's label and icon as plain data.

- [#788](https://github.com/JollyPixel/editor/pull/788) [`4a6ffd0`](https://github.com/JollyPixel/editor/commit/4a6ffd0841535389f5c61246cbf8d5b45d9f408e) Thanks [@fraxken](https://github.com/fraxken)! - Add `InvalidAssetDocumentError`, thrown by a kind's `load` when its content is not a document of that kind.
  `AssetStateStore` logs it at warn level instead of error.

- [#837](https://github.com/JollyPixel/editor/pull/837) [`50df26e`](https://github.com/JollyPixel/editor/commit/50df26ebaeef139dc80a7ecce88fa786ea248caf) Thanks [@fraxken](https://github.com/fraxken)! - `catalog:create`, `CatalogClient.create` (with `null` content) and `AssetWriter.create` accept no content and write the kind's default state.
  Handlers can declare `companions`, created and linked beside an asset created without content; `AssetKindDescriptor` gains `extension`.

- [#845](https://github.com/JollyPixel/editor/pull/845) [`399e1e4`](https://github.com/JollyPixel/editor/commit/399e1e448a7cab33990ccb000c381ec266060de5) Thanks [@fraxken](https://github.com/fraxken)! - Add `renderOnDemand` to `Runtime`, built on `GameLoop` `keepAlive`/`invalidate()` (sleeps after `trailingRenders`) and `FrameScheduler.skipGap()`, with `invalidate()`/`keepAlive()` on the engine `World` and `wasActive` on the controls `Input`.
  `OrbitFlyCamera`, `VoxelRenderer` (new `VoxelView` `requestFrame`) and `PeerFrustumSync` (new `requestFrame`, trailing pose publish) now request the frames they need.
  Joins receive a cached `encodeSnapshot()` form (PNG pixels: 2.7 MB to 165 KB for a 1024x512 tileset) that `CommandSync.applySnapshot` loads in order; a cold asset room restores its arbiter from the replay, and rooms share compiled validators through `MessageParser.of`.

- [#838](https://github.com/JollyPixel/editor/pull/838) [`e1c4a2d`](https://github.com/JollyPixel/editor/commit/e1c4a2d163156a30dd89a432fd801eb23c4687c4) Thanks [@fraxken](https://github.com/fraxken)! - Add illustrated icons: `registerIcon(name, glyph, { viewBox })` draws a full-colour glyph on its own grid, read back with `iconViewBox()`, and `jolly-tree` gains `--jolly-tree-icon-size`.
  `AssetKindIcon` accepts `viewBox`.

- [#823](https://github.com/JollyPixel/editor/pull/823) [`1bbae1c`](https://github.com/JollyPixel/editor/commit/1bbae1ceddffa7431cbe9c711d41a3c401a5dc93) Thanks [@fraxken](https://github.com/fraxken)! - `CommandSync` keeps a pending ledger acknowledged by echoes and `acks`, and rebases it on every server change through an optional `CommandReconciler`; `Room` gains `resync()` and `resumeWith()`, and `Client` reconnects with backoff and resumes its rooms from the last room `version`.
  Asset rooms send `version` and `acks`, answer a resumed join with a `catch-up`, and resolve conflicts in server order (event versions, `basis` for replays); `ConflictTracker` gains `record()` and versioned `commit()`/`reset()`.
  Voxel layer commands address layers by `layerId`, order them by a fractional `rank` (world format v4, `reordered` removed) and can rename them; `VoxelWorld.recorder` becomes `addRecorder()`/`removeRecorder()` with `includeUnrecorded`.

- [#802](https://github.com/JollyPixel/editor/pull/802) [`5d415e4`](https://github.com/JollyPixel/editor/commit/5d415e4f680fd90ba0ec3819b018baa5c59382fe) Thanks [@fraxken](https://github.com/fraxken)! - Asset rooms clamp future command timestamps and send the author a snapshot after a refused, narrowed or unappended command; `CommandSync` replays its own echoes a snapshot overtook and adds `whenReady()`. `ConflictTracker` records headers only and gains `reset()`; `commandVariant()` and `withCommandHeader()` build command schemas, and `seq` must be a non-negative integer.
  `PixelDocument` emits `buffer-updated` next to its `onBufferUpdated` hook; `AssetRoomNotice` names the asset room notice union.

### Patch Changes

- [#786](https://github.com/JollyPixel/editor/pull/786) [`482d8b7`](https://github.com/JollyPixel/editor/commit/482d8b7d9462d8cd57ee09e21f4d650d9f7cbc17) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - `exportAssetArchive` loads each document through its kind and rejects with `unreadable-asset` instead of producing an archive that import refuses.
  Add `PixelDocument.disownUvRegions()` so another document can own UV regions, and an optional `UVMap.clear()` filter; `UVCompound.parts` is now mutable.
  Export the UV geometry helpers `rectOf()`, `triangleCornerOf()` and `withRotation()`.
- Updated dependencies [[`0db872e`](https://github.com/JollyPixel/editor/commit/0db872e6e3567a4a0deca4ad6bda0b30d3b643c9), [`20c529d`](https://github.com/JollyPixel/editor/commit/20c529d199eb0e5a7430c99003872398a065604e), [`399e1e4`](https://github.com/JollyPixel/editor/commit/399e1e448a7cab33990ccb000c381ec266060de5), [`e206538`](https://github.com/JollyPixel/editor/commit/e2065388190abbe17facabbbe64fac562fa628de), [`8d33c94`](https://github.com/JollyPixel/editor/commit/8d33c9415c21955b94f3c294ceb347f733534787), [`1bbae1c`](https://github.com/JollyPixel/editor/commit/1bbae1ceddffa7431cbe9c711d41a3c401a5dc93), [`5d415e4`](https://github.com/JollyPixel/editor/commit/5d415e4f680fd90ba0ec3819b018baa5c59382fe), [`4a6ffd0`](https://github.com/JollyPixel/editor/commit/4a6ffd0841535389f5c61246cbf8d5b45d9f408e), [`71d300a`](https://github.com/JollyPixel/editor/commit/71d300a76e87200b52cb4a1e9394ce22793c2a8a), [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285)]:
  - @jolly-pixel/asset@3.0.0
  - @jolly-pixel/asset-source@3.0.0
  - @jolly-pixel/network@5.0.0
  - @jolly-pixel/event-store@4.0.0

## 4.0.0

### Major Changes

- [#727](https://github.com/JollyPixel/editor/pull/727) [`3f115d7`](https://github.com/JollyPixel/editor/commit/3f115d726114f00b281f74d42182fd37b3502d44) Thanks [@fraxken](https://github.com/fraxken)! - `AssetKindHandler` replaces `match` + `contentTypes` with required `extensions` (extension to content type, multi-dot allowed); `match` now only narrows the claim.
  `textureAssetHandler`/`binaryAssetHandler` are renamed `textureAssetKind`/`binaryAssetKind`, and `resolveContentType` picks the longest matching extension.

### Minor Changes

- [#760](https://github.com/JollyPixel/editor/pull/760) [`8d2c08f`](https://github.com/JollyPixel/editor/commit/8d2c08f484a8ab7b1ef055c6d45c8267f7c6fc6d) Thanks [@fraxken](https://github.com/fraxken)! - Add archive import as copy with new IDs and optional asset-kind reference rebinding.
  Report incompatible kind collisions during planning so callers can offer copy.
  Add `CatalogProjection.dependenciesFirst` and `DependencyIndex.dependenciesFirst`.

- [#744](https://github.com/JollyPixel/editor/pull/744) [`711429b`](https://github.com/JollyPixel/editor/commit/711429bbf691c24a26f2b53d843e0eb63a098e41) Thanks [@fraxken](https://github.com/fraxken)! - Add ZIP asset archives: `exportAssetArchive`, `readAssetArchive`, `planAssetImport` and `importAssetArchive`.
  The catalog room gains `catalog:export`, `catalog:plan` and `catalog:import`, with matching `CatalogClient` methods.
  Fix `AssetProjector` dropping an event absorbed while a slower write of the same asset was in flight.

- [#725](https://github.com/JollyPixel/editor/pull/725) [`9e4b7a1`](https://github.com/JollyPixel/editor/commit/9e4b7a16d5348458027d06eafc68baf51ca4f519) Thanks [@fraxken](https://github.com/fraxken)! - Track asset dependency edges: `AssetKindHandler.dependencies`, a `dependencies` field on write events, a live catalog edge index with boot backfill, and a Vite `launch` option.
  `TilesetDefinition.src` is now optional; an asset-backed tileset names its pixels with `asset` instead.
  `PixelDocument` now owns edits, history replay and remote sync, so it runs headless and several `PixelArtCanvas` can share one through the new `document` option.

- [#754](https://github.com/JollyPixel/editor/pull/754) [`0537d74`](https://github.com/JollyPixel/editor/commit/0537d742cf409edd25c18a52547a9c92e1d1a673) Thanks [@fraxken](https://github.com/fraxken)! - Refuse `catalog:delete` while another asset still references the target, naming the dependents in the rejection reason.
  A caller that warned its user resends with `force: true`; `catalogDeleteProtection: false` turns the check off, and `AssetWriter.remove` and reconciliation stay unguarded.

- [#760](https://github.com/JollyPixel/editor/pull/760) [`737f586`](https://github.com/JollyPixel/editor/commit/737f586ad7ab8ff8caa129f781fb3f657f76df64) Thanks [@fraxken](https://github.com/fraxken)! - Export `CatalogSessionArchive` from the browser catalog client for Blob-based archive operations.
  Allow callers to disable import while keeping export and planning available.

- [#743](https://github.com/JollyPixel/editor/pull/743) [`6321913`](https://github.com/JollyPixel/editor/commit/632191387a3708bbefaebfc8f59bf0c105c4f242) Thanks [@fraxken](https://github.com/fraxken)! - The asset back-end can run inside a browser page: `LoopbackTransport` and `ClientOptions.socket` connect a `Client` to an in-process `Server`.
  New Node-free entries `@jolly-pixel/asset-source/core` and `@jolly-pixel/asset-server/backend`.
  Content hashes use WebCrypto: `writeData()` is async and `AssetWriter` applies writes one at a time, in call order.

### Patch Changes

- [#743](https://github.com/JollyPixel/editor/pull/743) [`6321913`](https://github.com/JollyPixel/editor/commit/632191387a3708bbefaebfc8f59bf0c105c4f242) Thanks [@fraxken](https://github.com/fraxken)! - Move password authentication and worker proxies to `network/node`; register workers as extension instances.
  Support browser timers and snapshot mutable asset inputs before asynchronous writes.
- Updated dependencies [[`9e4b7a1`](https://github.com/JollyPixel/editor/commit/9e4b7a16d5348458027d06eafc68baf51ca4f519), [`3f115d7`](https://github.com/JollyPixel/editor/commit/3f115d726114f00b281f74d42182fd37b3502d44), [`2c0dcdf`](https://github.com/JollyPixel/editor/commit/2c0dcdfdd4990c315ee873f9eb2eaabe34155dd1), [`8d2c08f`](https://github.com/JollyPixel/editor/commit/8d2c08f484a8ab7b1ef055c6d45c8267f7c6fc6d), [`711429b`](https://github.com/JollyPixel/editor/commit/711429bbf691c24a26f2b53d843e0eb63a098e41), [`6321913`](https://github.com/JollyPixel/editor/commit/632191387a3708bbefaebfc8f59bf0c105c4f242), [`6321913`](https://github.com/JollyPixel/editor/commit/632191387a3708bbefaebfc8f59bf0c105c4f242)]:
  - @jolly-pixel/asset@2.1.0
  - @jolly-pixel/asset-source@2.1.0
  - @jolly-pixel/network@4.0.0

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
