# @jolly-pixel/asset-server

## 7.0.1

### Patch Changes

- Updated dependencies [[`f711a5f`](https://github.com/JollyPixel/editor/commit/f711a5ff57a7d3513f7d2edb9a469b1f08884b25)]:
  - @jolly-pixel/utils@1.1.1
  - @jolly-pixel/network@7.0.1

## 7.0.0

### Major Changes

- [#1160](https://github.com/JollyPixel/editor/pull/1160) [`7ddc912`](https://github.com/JollyPixel/editor/commit/7ddc91235d9fd536e43c317f092620fb15bd63c7) Thanks [@fraxken](https://github.com/fraxken)! - Asset conversions can create companion assets next to the converted one. `CreateAssetInput` now takes either a payload or a `converted` asset.

- [#1102](https://github.com/JollyPixel/editor/pull/1102) [`19e8fb2`](https://github.com/JollyPixel/editor/commit/19e8fb24034a423e62b3ac9e2021b834984de0e9) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Tag backups and tag rooms now include asset parts, and listing parts no longer loads the asset state. `AssetTags` requires `kinds`.

- [#1128](https://github.com/JollyPixel/editor/pull/1128) [`75493f9`](https://github.com/JollyPixel/editor/commit/75493f9032176bfa25b4758b867c22f5b36c872f) Thanks [@fraxken](https://github.com/fraxken)! - Follow the async event store: await `AssetTags.list`, `read` and `delete`, and `LiveAssetRoom.connect`, `receive` and `resync`.

- [#1193](https://github.com/JollyPixel/editor/pull/1193) [`9a805e5`](https://github.com/JollyPixel/editor/commit/9a805e5fa847c30d41495bda22051e1aa6ed02f5) Thanks [@fraxken](https://github.com/fraxken)! - Asset content is sent and stored as raw bytes instead of base64; older base64 events still load. Replace `encodeContent`/`decodeContent` with `{ type: "inline", data }`.

- [#1237](https://github.com/JollyPixel/editor/pull/1237) [`5af0632`](https://github.com/JollyPixel/editor/commit/5af0632f9ae65a6005861f839adb4e97d22c209f) Thanks [@fraxken](https://github.com/fraxken)! - Asset kinds can declare capabilities, and one backend snapshot policy replaces the per-kind `snapshot` option. `jolly-text` gains `suggestions` and `select()`.

### Minor Changes

- [#1231](https://github.com/JollyPixel/editor/pull/1231) [`40b7a52`](https://github.com/JollyPixel/editor/commit/40b7a52eb6d394cfb4959aeb07abe807fb599bb0) Thanks [@fraxken](https://github.com/fraxken)! - `CatalogClient.connect` accepts an abort `signal`, client logs can be redirected with `consoleLogger`, and clients can apply raw commands to a synced document.

- [#1214](https://github.com/JollyPixel/editor/pull/1214) [`d1dfafc`](https://github.com/JollyPixel/editor/commit/d1dfafc41e11fd3bf790f83393d199eea9d59082) Thanks [@fraxken](https://github.com/fraxken)! - Asset kinds can declare a `build` hook that produces a game-ready version of an asset, built once per revision.

- [#1195](https://github.com/JollyPixel/editor/pull/1195) [`00f50e5`](https://github.com/JollyPixel/editor/commit/00f50e5af2be1dcb0d11a6731330ffb823a6f802) Thanks [@fraxken](https://github.com/fraxken)! - `AssetCommands.upcast` rewrites stored commands of an older shape before replay folds them and before a resume resends them.
  `AssetLiveProtocol.compressCommands` hints deflate for broadcast commands and catch-ups.

- [#1114](https://github.com/JollyPixel/editor/pull/1114) [`fa742ce`](https://github.com/JollyPixel/editor/commit/fa742ceefc37a374ee60e6638ed3c0a8f1d06539) Thanks [@fraxken](https://github.com/fraxken)! - Add `JsonAssetFile`, a JSON codec for asset files, and `arbitrated()` to add conflict arbitration to a kind's live protocol.

- [#1203](https://github.com/JollyPixel/editor/pull/1203) [`c41299e`](https://github.com/JollyPixel/editor/commit/c41299eab87538146550d8b4576f1516cd62badc) Thanks [@fraxken](https://github.com/fraxken)! - Asset kinds can serve previews through `CatalogClient.preview`, and peers can join as observers hidden from presence. Three adds `renderToTarget` and `ReadbackPixels`.

- [#1277](https://github.com/JollyPixel/editor/pull/1277) [`6beff74`](https://github.com/JollyPixel/editor/commit/6beff740e5afa55882ad6b1232b2c7dff5ebadad) Thanks [@fraxken](https://github.com/fraxken)! - Live asset rooms can read project files such as `.editorconfig`; `AssetRoomBinding` now requires `path()` and `readFile(path)`.

- [#1284](https://github.com/JollyPixel/editor/pull/1284) [`b3b326c`](https://github.com/JollyPixel/editor/commit/b3b326c883452fa9ecabed200ad9ba15dc66ebbe) Thanks [@fraxken](https://github.com/fraxken)! - Archive export applies the same limits as import, duplicate parts are rejected, and part IDs and part subscriptions are capped.

- [#1247](https://github.com/JollyPixel/editor/pull/1247) [`6f83ad9`](https://github.com/JollyPixel/editor/commit/6f83ad96f79668f426e90a6f7e183d6f676778ea) Thanks [@fraxken](https://github.com/fraxken)! - `LaunchPayload` takes a `socket` URL, relative to the page's URL, for pages served under a path prefix.

- [#1215](https://github.com/JollyPixel/editor/pull/1215) [`aed15b7`](https://github.com/JollyPixel/editor/commit/aed15b78637ddbf648e405969fa8548ff378e365) Thanks [@fraxken](https://github.com/fraxken)! - `PackageResolver.ignoreGlobs()` lists the root `package.json` and the local package folders to pass as the new `AssetServer` `ignore` option.
  Folder delete and move refuse reserved paths, and `__proto__` is no longer a valid part ID.

- [#1195](https://github.com/JollyPixel/editor/pull/1195) [`033a975`](https://github.com/JollyPixel/editor/commit/033a975db5003d093263c9f9820c0fde7b00ff39) Thanks [@fraxken](https://github.com/fraxken)! - Binary frames are compressed only when the sender asks, through `SendOptions { compress }`, which replaces `compression.binary`. `PngPixels.data` is now a `Uint8Array`.

- [#1195](https://github.com/JollyPixel/editor/pull/1195) [`d9cb732`](https://github.com/JollyPixel/editor/commit/d9cb7324a3b32509a5e3c9be31f0342bf947053c) Thanks [@fraxken](https://github.com/fraxken)! - Large binary snapshots can be served as content refs fetched over HTTP instead of being inlined in the room, enabled with `AssetServer.open({ content })`.

- [#1213](https://github.com/JollyPixel/editor/pull/1213) [`78cd5bf`](https://github.com/JollyPixel/editor/commit/78cd5bf069f65a8aef943198b9a0fd6b8fab0edc) Thanks [@fraxken](https://github.com/fraxken)! - Add the `catalog:progress` message: the server tells the author of a `catalog:create` each stage it enters (`converting`, then `writing`) before replying.
  `CatalogClient.create` takes an `onProgress(stage)` option to follow them.

- [#1178](https://github.com/JollyPixel/editor/pull/1178) [`5494a67`](https://github.com/JollyPixel/editor/commit/5494a67d7495071378b5eae430d51ef034cb5c35) Thanks [@fraxken](https://github.com/fraxken)! - Extensions can declare read-only `queries`, such as `CatalogClient.read(assetId)`. Kind resolution picks the longest matching extension.

- [#1109](https://github.com/JollyPixel/editor/pull/1109) [`d36f467`](https://github.com/JollyPixel/editor/commit/d36f46702ac084e4305eca2114d19de84b7ea4e7) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Add `CatalogClient.replace` to swap an asset's content while keeping its ID and path; the old content is kept as a restore point.

- [#1274](https://github.com/JollyPixel/editor/pull/1274) [`c1f706c`](https://github.com/JollyPixel/editor/commit/c1f706ca4946937ef4a76648c8ab15cbdc93dadf) Thanks [@fraxken](https://github.com/fraxken)! - `AssetKindHandler.create(assetId, path?)` receives the path a new asset or seed entry is written to, after any conflict suffix.
  `jolly-tree` emits `jolly-rename-end` when a rename ends, with the committed name or `null` when cancelled.

- [#1170](https://github.com/JollyPixel/editor/pull/1170) [`16bbd07`](https://github.com/JollyPixel/editor/commit/16bbd079b24d734cfab3d51b044428b2176ff2eb) Thanks [@fraxken](https://github.com/fraxken)! - Asset kinds can set their own `maxContentBytes` (up to 128 MiB), and `CatalogClient` refuses oversized content before sending it.

- [#1207](https://github.com/JollyPixel/editor/pull/1207) [`96a79a5`](https://github.com/JollyPixel/editor/commit/96a79a5f31fb6ff8c0ad26c011f1ecbef2b6988c) Thanks [@fraxken](https://github.com/fraxken)! - `PackageResolver` takes `searchFolders`: folders whose subfolders are packages, matched by their manifest `name` when no `node_modules` holds the package.

- [#1111](https://github.com/JollyPixel/editor/pull/1111) [`f17d58f`](https://github.com/JollyPixel/editor/commit/f17d58f00807c0dd3bf6404e07bcc5b74a6cd7ab) Thanks [@fraxken](https://github.com/fraxken)! - Add `createProjectContributionsPlugin`, which serves `virtual:jolly-pixel/contributions/<field>`: the export subpath that each project package names under `jollypixel.<field>` in its manifest.

- [#1142](https://github.com/JollyPixel/editor/pull/1142) [`8a3c591`](https://github.com/JollyPixel/editor/commit/8a3c591b84dff46454fbad1717421400cad301c5) Thanks [@fraxken](https://github.com/fraxken)! - Add `TextDefinition`, and `TextRenderer` takes an `asset` or a `font`. Kinds can be import-only, and `SnapshotDocument` serves documents a client only reads.

- [#1156](https://github.com/JollyPixel/editor/pull/1156) [`a89aeb7`](https://github.com/JollyPixel/editor/commit/a89aeb73fa118659494d3d9410dd9135fc39b551) Thanks [@fraxken](https://github.com/fraxken)! - Add `AssetLiveProtocol.authorRebases`, which skips the author's correction for kinds whose clients transform edits themselves, and a `reloaded()` hook called before a reload snapshot. `CommandSync` exposes its guarded `resync()` to subclasses.

- [#1143](https://github.com/JollyPixel/editor/pull/1143) [`27fbfae`](https://github.com/JollyPixel/editor/commit/27fbfae07d4341977df582997b8ab8e05130de25) Thanks [@fraxken](https://github.com/fraxken)! - Export `binaryCommands`, the read-only commands of a kind whose room snapshot is its raw bytes.

- [#1208](https://github.com/JollyPixel/editor/pull/1208) [`f5350de`](https://github.com/JollyPixel/editor/commit/f5350de576d82af8592928a4456f43702befff26) Thanks [@fraxken](https://github.com/fraxken)! - Asset-server exports `TEXTURE_EXTENSIONS`, the extension to MIME type table of the built-in texture kind.
  Utils adds `fileExtension(path)`, the lowercased extension of the last path segment.

- [#1103](https://github.com/JollyPixel/editor/pull/1103) [`293b03d`](https://github.com/JollyPixel/editor/commit/293b03d92636ee1b7a31531635ebea69e398520d) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - The built-in `texture` kind opens a read-only live room whose snapshot is the image file as `AssetInlineContent`; it accepts no command. Add `TEXTURE_ASSET`, a descriptor to list textures in asset pickers.

### Patch Changes

- [#1131](https://github.com/JollyPixel/editor/pull/1131) [`7bfe12b`](https://github.com/JollyPixel/editor/commit/7bfe12b6c35e5b074c5a9109d1f97048856b6470) Thanks [@fraxken](https://github.com/fraxken)! - `catalog:create` now rejects content its asset kind cannot load, before anything is written.

- [#1167](https://github.com/JollyPixel/editor/pull/1167) [`b607031`](https://github.com/JollyPixel/editor/commit/b6070316cd26c59ecec07dae783a5062d43bcef5) Thanks [@fraxken](https://github.com/fraxken)! - `LiveAssetRoom` snapshots now carry the room version, so clients base edits made after a resync on the right version.

- [#1242](https://github.com/JollyPixel/editor/pull/1242) [`6320c3e`](https://github.com/JollyPixel/editor/commit/6320c3e06a580930930e79a9e896613e4688f3c2) Thanks [@fraxken](https://github.com/fraxken)! - `AssetServer.open` writes its `seed` only into a project that holds no document yet, so a deleted seed asset no longer comes back on the next start.

- [#1278](https://github.com/JollyPixel/editor/pull/1278) [`0045412`](https://github.com/JollyPixel/editor/commit/004541258891ba858e6cc7e2f48847b0b5a0db2e) Thanks [@fraxken](https://github.com/fraxken)! - Importing `TEXTURE_ASSET`, `TEXTURE_KIND`, `TEXTURE_COMMAND` or `TEXTURE_EXTENSIONS` no longer bundles the texture kind handler: they live in a module of their own.

- [#1234](https://github.com/JollyPixel/editor/pull/1234) [`90c9692`](https://github.com/JollyPixel/editor/commit/90c9692fc0508e2b784c097ed119090bfe07e850) Thanks [@fraxken](https://github.com/fraxken)! - Move shared helpers such as `delay`, `withTimeout`, `DeepReadonly` and `sha256Hex` into `@jolly-pixel/utils`.

- [#1192](https://github.com/JollyPixel/editor/pull/1192) [`d26da53`](https://github.com/JollyPixel/editor/commit/d26da53c969781c9c1c3062f6f0b6df2f5b8ecfa) Thanks [@fraxken](https://github.com/fraxken)! - Add `@jolly-pixel/utils` for shared helpers; `saveFile` and `formatBytes` move there from `@jolly-pixel/ui`.
- Updated dependencies [[`40b7a52`](https://github.com/JollyPixel/editor/commit/40b7a52eb6d394cfb4959aeb07abe807fb599bb0), [`69ba6ea`](https://github.com/JollyPixel/editor/commit/69ba6ea57e3d74350f44c1b36e361c6c01ad2f8f), [`ec79d3f`](https://github.com/JollyPixel/editor/commit/ec79d3f32c41f9c43ea81271e805fe48416e1d6a), [`5b2019f`](https://github.com/JollyPixel/editor/commit/5b2019f7ae2624255c6c2ac3ea510fe817005ac0), [`b7d2f82`](https://github.com/JollyPixel/editor/commit/b7d2f8249cb29ac71e78cb7e92730a2d818d567f), [`c41299e`](https://github.com/JollyPixel/editor/commit/c41299eab87538146550d8b4576f1516cd62badc), [`033a975`](https://github.com/JollyPixel/editor/commit/033a975db5003d093263c9f9820c0fde7b00ff39), [`d9cb732`](https://github.com/JollyPixel/editor/commit/d9cb7324a3b32509a5e3c9be31f0342bf947053c), [`5494a67`](https://github.com/JollyPixel/editor/commit/5494a67d7495071378b5eae430d51ef034cb5c35), [`0d95f1f`](https://github.com/JollyPixel/editor/commit/0d95f1f55a3020accd4e947a833aa68960267526), [`75493f9`](https://github.com/JollyPixel/editor/commit/75493f9032176bfa25b4758b867c22f5b36c872f), [`00f50e5`](https://github.com/JollyPixel/editor/commit/00f50e5af2be1dcb0d11a6731330ffb823a6f802), [`b6be924`](https://github.com/JollyPixel/editor/commit/b6be924139de006228f9eb9e93480e0f21aa8201), [`c1a8763`](https://github.com/JollyPixel/editor/commit/c1a87634da5e6c17e86fc3a1f9fcec587d9a5f64), [`9a805e5`](https://github.com/JollyPixel/editor/commit/9a805e5fa847c30d41495bda22051e1aa6ed02f5), [`24991a6`](https://github.com/JollyPixel/editor/commit/24991a6edf1f7230b9268ffa647151ebe52d808e), [`6f83ad9`](https://github.com/JollyPixel/editor/commit/6f83ad96f79668f426e90a6f7e183d6f676778ea), [`8890073`](https://github.com/JollyPixel/editor/commit/8890073623d0035da1b8b662c1477d217e58a09b), [`40b7a52`](https://github.com/JollyPixel/editor/commit/40b7a52eb6d394cfb4959aeb07abe807fb599bb0), [`40b7a52`](https://github.com/JollyPixel/editor/commit/40b7a52eb6d394cfb4959aeb07abe807fb599bb0), [`b8d702d`](https://github.com/JollyPixel/editor/commit/b8d702d7da9e919b194ad25bdbca76aa86c95311), [`a89aeb7`](https://github.com/JollyPixel/editor/commit/a89aeb73fa118659494d3d9410dd9135fc39b551), [`5af0632`](https://github.com/JollyPixel/editor/commit/5af0632f9ae65a6005861f839adb4e97d22c209f), [`f5350de`](https://github.com/JollyPixel/editor/commit/f5350de576d82af8592928a4456f43702befff26), [`a2e6a27`](https://github.com/JollyPixel/editor/commit/a2e6a27dc11dedbd444ea7698158f320f1cb4402), [`f998437`](https://github.com/JollyPixel/editor/commit/f998437cc19077ec578beaf254cc826407e378f5), [`90c9692`](https://github.com/JollyPixel/editor/commit/90c9692fc0508e2b784c097ed119090bfe07e850), [`974ed36`](https://github.com/JollyPixel/editor/commit/974ed36053e2e6aab2a71cbc7e47e3e0fcb77f58), [`d26da53`](https://github.com/JollyPixel/editor/commit/d26da53c969781c9c1c3062f6f0b6df2f5b8ecfa)]:
  - @jolly-pixel/network@7.0.0
  - @jolly-pixel/asset@5.0.0
  - @jolly-pixel/event-store@6.0.0
  - @jolly-pixel/utils@1.1.0
  - @jolly-pixel/asset-source@4.0.1

## 6.0.0

### Major Changes

- [#859](https://github.com/JollyPixel/editor/pull/859) [`425cef9`](https://github.com/JollyPixel/editor/commit/425cef984d0c6e5bf06f99fa29e0282acb47350b) Thanks [@fraxken](https://github.com/fraxken)! - Empty folders now persist: `AssetSource` and `CatalogClient` can list, create, move and delete folders. `watch` callbacks also say whether a file or a folder changed.

- [#1071](https://github.com/JollyPixel/editor/pull/1071) [`32d05ac`](https://github.com/JollyPixel/editor/commit/32d05acf969fc7b09067ffcda2fcea0e6191fbcd) Thanks [@fraxken](https://github.com/fraxken)! - Add `AssetKind` and `AssetPath`, which replace `AssetSource`; asset records carry `path` instead of `source`.

- [#863](https://github.com/JollyPixel/editor/pull/863) [`6adf788`](https://github.com/JollyPixel/editor/commit/6adf788e94caa25e8550d3eed89e3720e52ab0fc) Thanks [@fraxken](https://github.com/fraxken)! - Reshape the catalog projection and backend API: use `backend.reconcile()` instead of `backend.internals`, and `exportAssetArchive` now returns a `Result`.

- [#1052](https://github.com/JollyPixel/editor/pull/1052) [`7e1b38c`](https://github.com/JollyPixel/editor/commit/7e1b38cc30b4c44336b4cf2caee67fb586301e6a) Thanks [@fraxken](https://github.com/fraxken)! - Rename `createAssetWorkspace` to `AssetServer.open`, whose network server is `assetServer.network`, and `createAssetWorkspacePlugin` to `createAssetServerPlugin`.

- [#1070](https://github.com/JollyPixel/editor/pull/1070) [`29ed99a`](https://github.com/JollyPixel/editor/commit/29ed99a3f4d2a5892c4c7f56721109bff3563fb1) Thanks [@fraxken](https://github.com/fraxken)! - Group backend options into `catalog`, `reconcile` and `compaction` (e.g. `catalog.maxContentBytes`, `compaction.onOpen`), and rename the state path exports to `ASSET_INDEX_PATH` and `BACKUP_OBJECTS_PATH`.

- [#1078](https://github.com/JollyPixel/editor/pull/1078) [`89073fc`](https://github.com/JollyPixel/editor/commit/89073fcf9c2ca0fa9ff2f1b5c00746c95544e47e) Thanks [@fraxken](https://github.com/fraxken)! - Catalog writes refuse paths the source ignores (`.git/`, `node_modules/`, `dist/`…), so a client can no longer write a git hook or a kind package. `AssetWriter` requires a `source` option.

- [#879](https://github.com/JollyPixel/editor/pull/879) [`f071e53`](https://github.com/JollyPixel/editor/commit/f071e53e866a18c6bb0adc86f996f22e14787e70) Thanks [@fraxken](https://github.com/fraxken)! - Catalog rename and delete accept lists (`renameMany`, `removeMany`), and members receive each batch of changes in one `catalog:changed` message.

- [#1069](https://github.com/JollyPixel/editor/pull/1069) [`176b005`](https://github.com/JollyPixel/editor/commit/176b005c86d6d2e62e6d03780d26cf6f770e2650) Thanks [@fraxken](https://github.com/fraxken)! - Rename `createDocument(room)` to `syncDocument(room)`, `InvalidAssetDocumentError` to `InvalidAssetFileError`, `ProjectFile.document` to `ProjectFile.data`, and the `.pixelart` codec to `PixelArtFile`.

- [#1024](https://github.com/JollyPixel/editor/pull/1024) [`9123c45`](https://github.com/JollyPixel/editor/commit/9123c4578d791cb8f9d3749e56d2c8268ee87ec7) Thanks [@fraxken](https://github.com/fraxken)! - Rename methods named `xOf`, `xFor` or `getX`/`setX` after what they do (for example `inverseOf` → `invert`, `UVRegion.rectFor` → `slotRect`, `MessageParser.of` → `fromProtocol`).
  The package docs list the new names; behavior is unchanged.

- [#1022](https://github.com/JollyPixel/editor/pull/1022) [`1a9db4f`](https://github.com/JollyPixel/editor/commit/1a9db4f0e48b42c9f23e302e117f24fcd1211e66) Thanks [@fraxken](https://github.com/fraxken)! - Schemas are written with zod instead of JSON Schema (`defineSchema` and `JSONSchema` are removed); kind packages export a zod `optionsSchema`.

### Minor Changes

- [#1034](https://github.com/JollyPixel/editor/pull/1034) [`5c9d715`](https://github.com/JollyPixel/editor/commit/5c9d7156f236fd7a2b3acae3c0a7c6f4ba6c8dd2) Thanks [@fraxken](https://github.com/fraxken)! - `createAssetBackend` accepts `compactOnOpen`, which `AssetServer.open` now forwards instead of compacting itself.
  The backend ignores a stored `state.json` when its event log is empty, so checkpoints from a lost log no longer hide new events.

- [#971](https://github.com/JollyPixel/editor/pull/971) [`bb6bbcc`](https://github.com/JollyPixel/editor/commit/bb6bbcc2e5e5fde1d9ab9d9ed88c8b009db583ae) Thanks [@fraxken](https://github.com/fraxken)! - Asset kinds can declare `conversions`, so a catalog create with `from: ".png"` converts the content into the kind's format.

- [#1072](https://github.com/JollyPixel/editor/pull/1072) [`8406e0f`](https://github.com/JollyPixel/editor/commit/8406e0f1ad3f4f34f988e62c00c7da35e51f5396) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Asset kinds can store their content as a manifest plus part files, and live rooms stream only the parts each member subscribes to.

- [#865](https://github.com/JollyPixel/editor/pull/865) [`35f9459`](https://github.com/JollyPixel/editor/commit/35f94598ed00f46dfd07152c752f8604d6ce436f) Thanks [@fraxken](https://github.com/fraxken)! - `AssetRoomExtension.onMessage` takes the command the network server already validated and no longer parses it a second time.
  `CatalogClient.toSnapshot()` returns its current state as a `catalog:snapshot` message.

- [#969](https://github.com/JollyPixel/editor/pull/969) [`8401f8e`](https://github.com/JollyPixel/editor/commit/8401f8e43817c0d11b41da8d1d2d85377b007093) Thanks [@fraxken](https://github.com/fraxken)! - Add `inMemory` to `AssetServer.open` and `createAssetServerPlugin` for an in-memory source and event log, and `ProjectFile.inMemory`, which `createProjectFileWatchPlugin` uses to skip a file kept in memory.

- [#857](https://github.com/JollyPixel/editor/pull/857) [`bf73b63`](https://github.com/JollyPixel/editor/commit/bf73b63a919ab87d1f6824754b07133e38b4719e) Thanks [@fraxken](https://github.com/fraxken)! - Load the asset kind packages a project lists in `.jollypixel/project.json` with `ProjectFile`, `ProjectKinds` and `KindPackage`, with Vite plugins to serve and watch them.

- [#928](https://github.com/JollyPixel/editor/pull/928) [`c86b214`](https://github.com/JollyPixel/editor/commit/c86b214c710a64428fa251465f3bcd7984471a36) Thanks [@fraxken](https://github.com/fraxken)! - `AssetBackendOptions.stateIgnores` adds host entries to the state directory's `.gitignore`.

- [#962](https://github.com/JollyPixel/editor/pull/962) [`7bdb4dd`](https://github.com/JollyPixel/editor/commit/7bdb4ddbdb0eed8c2882ece4a3911fe43b9cc436) Thanks [@fraxken](https://github.com/fraxken)! - Add asset tags: `backend.tags` creates, lists, restores and deletes them, and the catalog room and `CatalogClient` expose the same calls.
  Tagged content and external edits the projector would overwrite are backed up in `.jollypixel/objects/`.

- [#867](https://github.com/JollyPixel/editor/pull/867) [`f03cb7a`](https://github.com/JollyPixel/editor/commit/f03cb7a89b574ba6965f3b88d0ad5796de6cbdce) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Rooms broadcast a fresh snapshot when an asset changes on disk, and peers' UV selections are outlined. Truncated UI labels show their full text on hover, and narrow tab strips collapse to icons.

- [#951](https://github.com/JollyPixel/editor/pull/951) [`86af3d5`](https://github.com/JollyPixel/editor/commit/86af3d5b5e2fcc0ca9db56460add568776bde5eb) Thanks [@fraxken](https://github.com/fraxken)! - Support KTX2 compressed textures: the `texture` kind claims `.ktx2`, and `Runtime` builds a loader from `assets.ktx2.transcoderPath`.

- [#922](https://github.com/JollyPixel/editor/pull/922) [`12dca6e`](https://github.com/JollyPixel/editor/commit/12dca6e98be8b71f9ef8517edcc17d8e8520fb72) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Add `CommandHistory` for per-person undo and redo on synced documents, refusing a step a peer changed since. `jolly-tree` gains `validateRename` and row warnings.

- [#869](https://github.com/JollyPixel/editor/pull/869) [`e646731`](https://github.com/JollyPixel/editor/commit/e646731d6968af9a58604f5b503950e73dfa9681) Thanks [@fraxken](https://github.com/fraxken)! - The event store adds `expectedVersion` appends and per-asset compaction, SQLite runs in WAL mode, and asset snapshots and reconciliation are faster and no longer drop commands.

- [#963](https://github.com/JollyPixel/editor/pull/963) [`f20007a`](https://github.com/JollyPixel/editor/commit/f20007a1717a9b9bbab779489156c36451be38a0) Thanks [@fraxken](https://github.com/fraxken)! - Add view-only share links: guests see a read-only catalog limited to one asset and what it depends on.

- [#1045](https://github.com/JollyPixel/editor/pull/1045) [`695ee81`](https://github.com/JollyPixel/editor/commit/695ee81072bd90cae25c03e5e850ce214153278b) Thanks [@fraxken](https://github.com/fraxken)! - Rights, roles, kind options and access requests can change without a restart. Accounts store per-account `preferences`. `OrbitFlyCamera` gains `invertY` and touchpad swipe modes.

- [#977](https://github.com/JollyPixel/editor/pull/977) [`6b9daee`](https://github.com/JollyPixel/editor/commit/6b9daee5304c6bf06fd77086633e682d35640afc) Thanks [@fraxken](https://github.com/fraxken)! - Open an asset at a tag, read-only, through tag rooms (`kind@tag:assetId`). `RightsGate.configured` becomes `gated`.

- [#1039](https://github.com/JollyPixel/editor/pull/1039) [`33f6b2f`](https://github.com/JollyPixel/editor/commit/33f6b2f3a7c5ced091a3500480fbd2160f5ffcc0) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Asset live protocols can relay ephemeral client messages outside the event log. `OrbitFlyCamera.teleport()` now holds the camera at the new pose.

- [#1048](https://github.com/JollyPixel/editor/pull/1048) [`e1e86cb`](https://github.com/JollyPixel/editor/commit/e1e86cb232b5e021d839a58b8b68013194308349) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - Relay schemas move to `AssetCommands.relay`, and `./testing` adds `LiveAssetRoom` and `mockAssetRoom`. Network adds `KeyedCommandArbiter`; `SyncedCommandDocument` now takes `<TDocument, TNotice>`.

### Patch Changes

- [#1021](https://github.com/JollyPixel/editor/pull/1021) [`334fb9b`](https://github.com/JollyPixel/editor/commit/334fb9b31baf67b797f0f9564ac4f6be2c689e11) Thanks [@fraxken](https://github.com/fraxken)! - Faster catalog joins and asset room edits, and SQLite appends no longer scan an asset's whole history.

- [#1019](https://github.com/JollyPixel/editor/pull/1019) [`e91817e`](https://github.com/JollyPixel/editor/commit/e91817e4dc21e0f659340de5ab426cdec4d45067) Thanks [@fraxken](https://github.com/fraxken)! - Update ata-validator to 1.53.0 and recompile the envelope validators.
  A protocol that declares no message now rejects payloads without running the union validator.

- [#1016](https://github.com/JollyPixel/editor/pull/1016) [`5df8953`](https://github.com/JollyPixel/editor/commit/5df89531ef26fe891a7ef5ed6144ea8dc2155bee) Thanks [@fraxken](https://github.com/fraxken)! - `encodePng` takes an optional row `filter`, shrinking tileset snapshots by about 40%. Base64 uses native APIs and `js-base64` is dropped.

- [#933](https://github.com/JollyPixel/editor/pull/933) [`02172bd`](https://github.com/JollyPixel/editor/commit/02172bd0a88a1db4612b76a41d78e424517f5ba0) Thanks [@fraxken](https://github.com/fraxken)! - Harden the servers: rights tables deny unmatched keys (end a role with `"*": "write"` to keep it open), WebSocket connections are checked and capped, and failed password logins are rate limited.

- [#1051](https://github.com/JollyPixel/editor/pull/1051) [`8323f7d`](https://github.com/JollyPixel/editor/commit/8323f7d1ac6ccb05c46407561cccf13a85098285) Thanks [@fraxken](https://github.com/fraxken)! - Drop `serverMessageProtocol`, `attributeCommand`, `ConflictTracker` and the `ConflictResolver` option; `CommandSync` requires a `reconciler`. Add the `SyncedDocument` base class.
- Updated dependencies [[`425cef9`](https://github.com/JollyPixel/editor/commit/425cef984d0c6e5bf06f99fa29e0282acb47350b), [`32d05ac`](https://github.com/JollyPixel/editor/commit/32d05acf969fc7b09067ffcda2fcea0e6191fbcd), [`8406e0f`](https://github.com/JollyPixel/editor/commit/8406e0f1ad3f4f34f988e62c00c7da35e51f5396), [`334fb9b`](https://github.com/JollyPixel/editor/commit/334fb9b31baf67b797f0f9564ac4f6be2c689e11), [`8539d87`](https://github.com/JollyPixel/editor/commit/8539d8702d62c6b27ade0f1e0bb13134b20e90fe), [`89073fc`](https://github.com/JollyPixel/editor/commit/89073fcf9c2ca0fa9ff2f1b5c00746c95544e47e), [`e91817e`](https://github.com/JollyPixel/editor/commit/e91817e4dc21e0f659340de5ab426cdec4d45067), [`35f9459`](https://github.com/JollyPixel/editor/commit/35f94598ed00f46dfd07152c752f8604d6ce436f), [`5af5621`](https://github.com/JollyPixel/editor/commit/5af5621e4223fb97ab38b22530a64c0884d52051), [`176b005`](https://github.com/JollyPixel/editor/commit/176b005c86d6d2e62e6d03780d26cf6f770e2650), [`c9726dc`](https://github.com/JollyPixel/editor/commit/c9726dc516927b5d119e066e7dfa0a1bca536eaf), [`5c9d715`](https://github.com/JollyPixel/editor/commit/5c9d7156f236fd7a2b3acae3c0a7c6f4ba6c8dd2), [`e330bb1`](https://github.com/JollyPixel/editor/commit/e330bb166a520f7dd4ae7cf4c0837bf721c7bb90), [`7bdb4dd`](https://github.com/JollyPixel/editor/commit/7bdb4ddbdb0eed8c2882ece4a3911fe43b9cc436), [`f174add`](https://github.com/JollyPixel/editor/commit/f174addea4b885bd601976b7fd730a91a0b047c4), [`59fc78a`](https://github.com/JollyPixel/editor/commit/59fc78a35178c8a5eee14462eb8b27ace71d1e22), [`9123c45`](https://github.com/JollyPixel/editor/commit/9123c4578d791cb8f9d3749e56d2c8268ee87ec7), [`86af3d5`](https://github.com/JollyPixel/editor/commit/86af3d5b5e2fcc0ca9db56460add568776bde5eb), [`ef2c7fe`](https://github.com/JollyPixel/editor/commit/ef2c7fe37e1d532b745e6462c26bb9f650ccc875), [`12dca6e`](https://github.com/JollyPixel/editor/commit/12dca6e98be8b71f9ef8517edcc17d8e8520fb72), [`c141b45`](https://github.com/JollyPixel/editor/commit/c141b453ebd7191ee44bd98b74825e8b9570264e), [`02172bd`](https://github.com/JollyPixel/editor/commit/02172bd0a88a1db4612b76a41d78e424517f5ba0), [`9bcc044`](https://github.com/JollyPixel/editor/commit/9bcc044e1feaaed69f3344d17bff5b7e7f3ea797), [`c86b214`](https://github.com/JollyPixel/editor/commit/c86b214c710a64428fa251465f3bcd7984471a36), [`85641f5`](https://github.com/JollyPixel/editor/commit/85641f5459de96c87aea28ae1ec5ef564991a760), [`40e16a4`](https://github.com/JollyPixel/editor/commit/40e16a4ae92fdb94931b59e9ba80af52330b1bc4), [`27cff63`](https://github.com/JollyPixel/editor/commit/27cff63c507ae72b62c0299999590c839f2ac492), [`28dae7b`](https://github.com/JollyPixel/editor/commit/28dae7b8ef17f600128ba02cfe33436afadf1c92), [`5fbedf2`](https://github.com/JollyPixel/editor/commit/5fbedf27124e3deb38992f3b70592b9536d9223c), [`8323f7d`](https://github.com/JollyPixel/editor/commit/8323f7d1ac6ccb05c46407561cccf13a85098285), [`13c7153`](https://github.com/JollyPixel/editor/commit/13c7153fcd2cfded9e0f9be6536e0aae8440ba19), [`3d53ea9`](https://github.com/JollyPixel/editor/commit/3d53ea9ae1d62eed99cde3dd80a1c8831deedffb), [`a75ee6d`](https://github.com/JollyPixel/editor/commit/a75ee6dc5ef94c274f0f3b69d8eeff73e018e495), [`e646731`](https://github.com/JollyPixel/editor/commit/e646731d6968af9a58604f5b503950e73dfa9681), [`a1c9713`](https://github.com/JollyPixel/editor/commit/a1c9713eafcdf644030bd565c4e119b84e3cfea8), [`f20007a`](https://github.com/JollyPixel/editor/commit/f20007a1717a9b9bbab779489156c36451be38a0), [`695ee81`](https://github.com/JollyPixel/editor/commit/695ee81072bd90cae25c03e5e850ce214153278b), [`6b9daee`](https://github.com/JollyPixel/editor/commit/6b9daee5304c6bf06fd77086633e682d35640afc), [`e1e86cb`](https://github.com/JollyPixel/editor/commit/e1e86cb232b5e021d839a58b8b68013194308349), [`75902c5`](https://github.com/JollyPixel/editor/commit/75902c51ba6fb64d72d322e9bc73a80e8dcfbce2), [`1a9db4f`](https://github.com/JollyPixel/editor/commit/1a9db4f0e48b42c9f23e302e117f24fcd1211e66)]:
  - @jolly-pixel/asset-source@4.0.0
  - @jolly-pixel/asset@4.0.0
  - @jolly-pixel/event-store@5.0.0
  - @jolly-pixel/network@6.0.0

## 5.0.0

### Major Changes

- [#782](https://github.com/JollyPixel/editor/pull/782) [`5d64074`](https://github.com/JollyPixel/editor/commit/5d64074fca7103b22c62c1d652baf8e09618e3c4) Thanks [@fraxken](https://github.com/fraxken)! - Catalog imports take configurable archive limits (`catalogArchiveLimits`); `ArchiveLimits` replaces `ReadAssetArchiveOptions`.

- [#781](https://github.com/JollyPixel/editor/pull/781) [`20c529d`](https://github.com/JollyPixel/editor/commit/20c529d199eb0e5a7430c99003872398a065604e) Thanks [@fraxken](https://github.com/fraxken)! - Asset and catalog handlers support ETags, `304` and byte ranges, and Windows-reserved path segments are refused everywhere.

- [#777](https://github.com/JollyPixel/editor/pull/777) [`d621be0`](https://github.com/JollyPixel/editor/commit/d621be08881b0fc979a7971ecf3712808bb834e5) Thanks [@fraxken](https://github.com/fraxken)! - Reshape the catalog API: `CatalogClient.connect()` replaces `catalogRoom()`, `requestId` is required on catalog commands, and session archives move to editor.host.

- [#789](https://github.com/JollyPixel/editor/pull/789) [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285) Thanks [@fraxken](https://github.com/fraxken)! - Package subpaths follow one naming scheme (`/node`, `/client`, `/browser`), and every package declares `exports`; for example, import `event-store/node` instead of `event-store/sqlite`. Package roots are browser-safe.

### Minor Changes

- [#796](https://github.com/JollyPixel/editor/pull/796) [`0db872e`](https://github.com/JollyPixel/editor/commit/0db872e6e3567a4a0deca4ad6bda0b30d3b643c9) Thanks [@fraxken](https://github.com/fraxken)! - `AssetCatalog` gains `find()` and `set()` and drops `replace()`, `firstOfKind()` and the fetch helpers. `AssetStore` is internal: use `AssetCoordinator.evict()`.

- [#820](https://github.com/JollyPixel/editor/pull/820) [`8d33c94`](https://github.com/JollyPixel/editor/commit/8d33c9415c21955b94f3c294ceb347f733534787) Thanks [@fraxken](https://github.com/fraxken)! - `AssetLiveProtocol` gains an optional `correct(command, admitted)`. When it returns a command, a refused or narrowed edit resyncs its author with a `correction` instead of a full snapshot.

- [#773](https://github.com/JollyPixel/editor/pull/773) [`3297510`](https://github.com/JollyPixel/editor/commit/3297510657a51f74aa04c24c64274bae3f7d885b) Thanks [@fraxken](https://github.com/fraxken)! - Make `content` optional on a seed entry: `seedAssetSource` takes `handlers` and writes the serialized `create(id)` state of the entry's kind instead.
  Add the `AssetKindDescriptor` type, a kind's label and icon as plain data.

- [#788](https://github.com/JollyPixel/editor/pull/788) [`4a6ffd0`](https://github.com/JollyPixel/editor/commit/4a6ffd0841535389f5c61246cbf8d5b45d9f408e) Thanks [@fraxken](https://github.com/fraxken)! - Add `InvalidAssetDocumentError`, thrown by a kind's `load` when its content is not a document of that kind.
  `AssetStateStore` logs it at warn level instead of error.

- [#837](https://github.com/JollyPixel/editor/pull/837) [`50df26e`](https://github.com/JollyPixel/editor/commit/50df26ebaeef139dc80a7ecce88fa786ea248caf) Thanks [@fraxken](https://github.com/fraxken)! - Assets can be created without content, starting from the kind's default state, and kinds can declare `companions` created alongside them.

- [#845](https://github.com/JollyPixel/editor/pull/845) [`399e1e4`](https://github.com/JollyPixel/editor/commit/399e1e448a7cab33990ccb000c381ec266060de5) Thanks [@fraxken](https://github.com/fraxken)! - Add `renderOnDemand` to `Runtime`: the loop sleeps when nothing changes, and cameras, voxel views and peer syncs request the frames they need. Room joins load a much smaller snapshot.

- [#838](https://github.com/JollyPixel/editor/pull/838) [`e1c4a2d`](https://github.com/JollyPixel/editor/commit/e1c4a2d163156a30dd89a432fd801eb23c4687c4) Thanks [@fraxken](https://github.com/fraxken)! - Add illustrated icons: `registerIcon(name, glyph, { viewBox })` draws a full-colour glyph on its own grid, read back with `iconViewBox()`, and `jolly-tree` gains `--jolly-tree-icon-size`.
  `AssetKindIcon` accepts `viewBox`.

- [#823](https://github.com/JollyPixel/editor/pull/823) [`1bbae1c`](https://github.com/JollyPixel/editor/commit/1bbae1ceddffa7431cbe9c711d41a3c401a5dc93) Thanks [@fraxken](https://github.com/fraxken)! - Clients reconnect with backoff and resume their rooms where they left off, rebasing pending local changes. Voxel layers are addressed by `layerId` (world format v4).

- [#802](https://github.com/JollyPixel/editor/pull/802) [`5d415e4`](https://github.com/JollyPixel/editor/commit/5d415e4f680fd90ba0ec3819b018baa5c59382fe) Thanks [@fraxken](https://github.com/fraxken)! - Asset rooms resend a snapshot to the author of a refused command, and `CommandSync` adds `whenReady()`. `PixelDocument` emits `buffer-updated`.

### Patch Changes

- [#786](https://github.com/JollyPixel/editor/pull/786) [`482d8b7`](https://github.com/JollyPixel/editor/commit/482d8b7d9462d8cd57ee09e21f4d650d9f7cbc17) Thanks [@AlexandreMalaj](https://github.com/AlexandreMalaj)! - `exportAssetArchive` rejects unreadable assets instead of writing an archive that import refuses. UV regions can be owned by another document, and the UV geometry helpers are exported.
- Updated dependencies [[`0db872e`](https://github.com/JollyPixel/editor/commit/0db872e6e3567a4a0deca4ad6bda0b30d3b643c9), [`20c529d`](https://github.com/JollyPixel/editor/commit/20c529d199eb0e5a7430c99003872398a065604e), [`399e1e4`](https://github.com/JollyPixel/editor/commit/399e1e448a7cab33990ccb000c381ec266060de5), [`e206538`](https://github.com/JollyPixel/editor/commit/e2065388190abbe17facabbbe64fac562fa628de), [`8d33c94`](https://github.com/JollyPixel/editor/commit/8d33c9415c21955b94f3c294ceb347f733534787), [`1bbae1c`](https://github.com/JollyPixel/editor/commit/1bbae1ceddffa7431cbe9c711d41a3c401a5dc93), [`5d415e4`](https://github.com/JollyPixel/editor/commit/5d415e4f680fd90ba0ec3819b018baa5c59382fe), [`4a6ffd0`](https://github.com/JollyPixel/editor/commit/4a6ffd0841535389f5c61246cbf8d5b45d9f408e), [`71d300a`](https://github.com/JollyPixel/editor/commit/71d300a76e87200b52cb4a1e9394ce22793c2a8a), [`b520e7e`](https://github.com/JollyPixel/editor/commit/b520e7e37c000763a492f68635af528ca461a285)]:
  - @jolly-pixel/asset@3.0.0
  - @jolly-pixel/asset-source@3.0.0
  - @jolly-pixel/network@5.0.0
  - @jolly-pixel/event-store@4.0.0

## 4.0.0

### Major Changes

- [#727](https://github.com/JollyPixel/editor/pull/727) [`3f115d7`](https://github.com/JollyPixel/editor/commit/3f115d726114f00b281f74d42182fd37b3502d44) Thanks [@fraxken](https://github.com/fraxken)! - Asset kinds declare `extensions` instead of `match` + `contentTypes`; `textureAssetHandler` and `binaryAssetHandler` become `textureAssetKind` and `binaryAssetKind`.

### Minor Changes

- [#760](https://github.com/JollyPixel/editor/pull/760) [`8d2c08f`](https://github.com/JollyPixel/editor/commit/8d2c08f484a8ab7b1ef055c6d45c8267f7c6fc6d) Thanks [@fraxken](https://github.com/fraxken)! - Add archive import as copy with new IDs and optional asset-kind reference rebinding.
  Report incompatible kind collisions during planning so callers can offer copy.
  Add `CatalogProjection.dependenciesFirst` and `DependencyIndex.dependenciesFirst`.

- [#744](https://github.com/JollyPixel/editor/pull/744) [`711429b`](https://github.com/JollyPixel/editor/commit/711429bbf691c24a26f2b53d843e0eb63a098e41) Thanks [@fraxken](https://github.com/fraxken)! - Export and import assets as ZIP archives, from code or through the catalog room. Fix `AssetProjector` dropping an event during a slow write.

- [#725](https://github.com/JollyPixel/editor/pull/725) [`9e4b7a1`](https://github.com/JollyPixel/editor/commit/9e4b7a16d5348458027d06eafc68baf51ca4f519) Thanks [@fraxken](https://github.com/fraxken)! - Track dependencies between assets in the catalog. Tilesets can point at a pixel-art `asset`, and several `PixelArtCanvas` can share one headless `PixelDocument`.

- [#754](https://github.com/JollyPixel/editor/pull/754) [`0537d74`](https://github.com/JollyPixel/editor/commit/0537d742cf409edd25c18a52547a9c92e1d1a673) Thanks [@fraxken](https://github.com/fraxken)! - Deleting an asset that others still reference is refused unless `force: true` is passed; `catalogDeleteProtection: false` turns the check off.

- [#760](https://github.com/JollyPixel/editor/pull/760) [`737f586`](https://github.com/JollyPixel/editor/commit/737f586ad7ab8ff8caa129f781fb3f657f76df64) Thanks [@fraxken](https://github.com/fraxken)! - Export `CatalogSessionArchive` from the browser catalog client for Blob-based archive operations.
  Allow callers to disable import while keeping export and planning available.

- [#743](https://github.com/JollyPixel/editor/pull/743) [`6321913`](https://github.com/JollyPixel/editor/commit/632191387a3708bbefaebfc8f59bf0c105c4f242) Thanks [@fraxken](https://github.com/fraxken)! - The asset backend can run inside a browser page through `LoopbackTransport`. Content hashing uses WebCrypto, so `writeData()` is async.

### Patch Changes

- [#743](https://github.com/JollyPixel/editor/pull/743) [`6321913`](https://github.com/JollyPixel/editor/commit/632191387a3708bbefaebfc8f59bf0c105c4f242) Thanks [@fraxken](https://github.com/fraxken)! - Move password authentication and worker proxies to `network/node`; register workers as extension instances.
  Support browser timers and snapshot mutable asset inputs before asynchronous writes.
- Updated dependencies [[`9e4b7a1`](https://github.com/JollyPixel/editor/commit/9e4b7a16d5348458027d06eafc68baf51ca4f519), [`3f115d7`](https://github.com/JollyPixel/editor/commit/3f115d726114f00b281f74d42182fd37b3502d44), [`2c0dcdf`](https://github.com/JollyPixel/editor/commit/2c0dcdfdd4990c315ee873f9eb2eaabe34155dd1), [`8d2c08f`](https://github.com/JollyPixel/editor/commit/8d2c08f484a8ab7b1ef055c6d45c8267f7c6fc6d), [`711429b`](https://github.com/JollyPixel/editor/commit/711429bbf691c24a26f2b53d843e0eb63a098e41), [`6321913`](https://github.com/JollyPixel/editor/commit/632191387a3708bbefaebfc8f59bf0c105c4f242), [`6321913`](https://github.com/JollyPixel/editor/commit/632191387a3708bbefaebfc8f59bf0c105c4f242)]:
  - @jolly-pixel/asset@2.1.0
  - @jolly-pixel/asset-source@2.1.0
  - @jolly-pixel/network@4.0.0

## 3.0.0

### Major Changes

- [#662](https://github.com/JollyPixel/editor/pull/662) [`c0a3c5d`](https://github.com/JollyPixel/editor/commit/c0a3c5d646741d8997a78724603f90cff92a886e) Thanks [@fraxken](https://github.com/fraxken)! - Asset kind handlers declare `load`, `clear` and a `commands` object instead of `apply` and `live()`, and commands are validated on append and replay.

- [#659](https://github.com/JollyPixel/editor/pull/659) [`853c83b`](https://github.com/JollyPixel/editor/commit/853c83b9070a249087dab57247bc8dad0605b781) Thanks [@fraxken](https://github.com/fraxken)! - Remove the unused `sync`, `catalog`, `rooms`, `static` and `workspace` subpath exports; import from the package root instead.
  Add a `kinds` entry exposing the asset kind handler contract, used by the renderer asset handlers.

- [#691](https://github.com/JollyPixel/editor/pull/691) [`26324fd`](https://github.com/JollyPixel/editor/commit/26324fde3b3922e1a3c1c33fb75cccfcfcbfe6e1) Thanks [@fraxken](https://github.com/fraxken)! - Narrow the root entry to the public surface; import `CATALOG_URL_PATH` and `AssetRoom` from `@jolly-pixel/asset`. `AssetWriter` and `Reconciler` drop their `source` and `kinds` options.

- [#690](https://github.com/JollyPixel/editor/pull/690) [`619e2a7`](https://github.com/JollyPixel/editor/commit/619e2a7c5599efb41e77d039c8a112ef02eabcc2) Thanks [@fraxken](https://github.com/fraxken)! - Move `createAssetStaticHandler` and the content-type helpers to `@jolly-pixel/asset-source`; pass `registry.contentTypes()` as `contentTypes` instead of `kinds`.

- [#636](https://github.com/JollyPixel/editor/pull/636) [`f0363be`](https://github.com/JollyPixel/editor/commit/f0363bea0dafae6f2e899b491c6f4c6d4f777acb) Thanks [@fraxken](https://github.com/fraxken)! - Add native existence checks and atomic conditional writes to `AssetSource`.
  Use conditional writes when initializing workspace assets and state files.

- [#659](https://github.com/JollyPixel/editor/pull/659) [`d61e341`](https://github.com/JollyPixel/editor/commit/d61e341ffbe1f555237cf0b586d628bf5c94c82f) Thanks [@fraxken](https://github.com/fraxken)! - The catalog room accepts create, rename and delete commands, and rooms of deleted assets announce the deletion. `AssetWriter` returns failures as results instead of throwing.

- [#689](https://github.com/JollyPixel/editor/pull/689) [`81f9fcc`](https://github.com/JollyPixel/editor/commit/81f9fcc003a62bb102e5f0cfb4cf439165778ccf) Thanks [@fraxken](https://github.com/fraxken)! - Tilesets are declared on the world (`engine.tilesets`), and `VoxelEngine` emits one `"command"` event that replaces the per-change callbacks. Add the browser `CatalogClient`.

- [#639](https://github.com/JollyPixel/editor/pull/639) [`55a1230`](https://github.com/JollyPixel/editor/commit/55a12309b7e3d4a3c7ba7efc47766655abaf10f9) Thanks [@fraxken](https://github.com/fraxken)! - Authenticate connections at the WebSocket handshake through an `AuthenticationProvider`. The client's `identity` becomes the untrusted `profile`, and roles missing from a rights table are denied.

- [#662](https://github.com/JollyPixel/editor/pull/662) [`ae6293b`](https://github.com/JollyPixel/editor/commit/ae6293bf83ef24d0e91569994594a87221577ea2) Thanks [@fraxken](https://github.com/fraxken)! - Remove the event store from `@jolly-pixel/network`; asset rooms take an event writer through `registerAssetRooms({ events })`.

- [#664](https://github.com/JollyPixel/editor/pull/664) [`271fba9`](https://github.com/JollyPixel/editor/commit/271fba955fe79253b972a13daf0419a696138788) Thanks [@fraxken](https://github.com/fraxken)! - Replace `SyncAdapter` with `CommandSync` and add `PresenceChannel`; presence set before `join()` travels with the join.

### Minor Changes

- [#678](https://github.com/JollyPixel/editor/pull/678) [`60bef9d`](https://github.com/JollyPixel/editor/commit/60bef9d4d51f63a269e31f26d1817399708f8b6a) Thanks [@fraxken](https://github.com/fraxken)! - `jolly-tab` can be closable and show a tooltip. Add the `catalogMaxContentBytes` option to change the create size cap.

### Patch Changes

- Updated dependencies [[`619e2a7`](https://github.com/JollyPixel/editor/commit/619e2a7c5599efb41e77d039c8a112ef02eabcc2), [`f0363be`](https://github.com/JollyPixel/editor/commit/f0363bea0dafae6f2e899b491c6f4c6d4f777acb), [`d61e341`](https://github.com/JollyPixel/editor/commit/d61e341ffbe1f555237cf0b586d628bf5c94c82f), [`81f9fcc`](https://github.com/JollyPixel/editor/commit/81f9fcc003a62bb102e5f0cfb4cf439165778ccf), [`55a1230`](https://github.com/JollyPixel/editor/commit/55a12309b7e3d4a3c7ba7efc47766655abaf10f9), [`ae6293b`](https://github.com/JollyPixel/editor/commit/ae6293bf83ef24d0e91569994594a87221577ea2), [`271fba9`](https://github.com/JollyPixel/editor/commit/271fba955fe79253b972a13daf0419a696138788)]:
  - @jolly-pixel/asset-source@2.0.0
  - @jolly-pixel/network@3.0.0
  - @jolly-pixel/asset@2.0.0

## 2.0.0

### Major Changes

- [#613](https://github.com/JollyPixel/editor/pull/613) [`ac9bcf8`](https://github.com/JollyPixel/editor/commit/ac9bcf8696b154763828b36d09511c046cd4f036) Thanks [@fraxken](https://github.com/fraxken)! - Extract filesystem and in-memory storage into `@jolly-pixel/asset-source`.
  BREAKING: Remove storage providers and path helpers from `asset-server`.

- [#612](https://github.com/JollyPixel/editor/pull/612) [`6b09dd6`](https://github.com/JollyPixel/editor/commit/6b09dd6faa48f8d8600cf4a8e8a3b9126b24afb9) Thanks [@fraxken](https://github.com/fraxken)! - `isAssetEvent` becomes `parseAssetEvent`, which returns a `Result` telling a foreign event from a malformed one.

- [#623](https://github.com/JollyPixel/editor/pull/623) [`02b3b44`](https://github.com/JollyPixel/editor/commit/02b3b44814abf14c24bfea237afababa6ff8b09c) Thanks [@fraxken](https://github.com/fraxken)! - Messages are parsed with JSON Schema: extensions declare `protocols` instead of `events` and `getEventName`. Fixes rights filtering on broadcasts.

- [#611](https://github.com/JollyPixel/editor/pull/611) [`402c2d9`](https://github.com/JollyPixel/editor/commit/402c2d952e774d2c96ead24b7c8d11ef568128a9) Thanks [@fraxken](https://github.com/fraxken)! - Use `EventStore.subscribe` and `reader.listFromCheckpoint` instead of `writer.on("append")` and `reader.lastVersionOf`; `openAssetEventStore` is removed.

### Minor Changes

- [#618](https://github.com/JollyPixel/editor/pull/618) [`d6b2a37`](https://github.com/JollyPixel/editor/commit/d6b2a37da51adcbfc84267c5276958299f58eb7b) Thanks [@fraxken](https://github.com/fraxken)! - Asset kinds describe a declarative `live()` protocol instead of a room extension; `PixelArtAssetExtension` and `VoxelMapAssetExtension` are removed.

- [#528](https://github.com/JollyPixel/editor/pull/528) [`d6f6a22`](https://github.com/JollyPixel/editor/commit/d6f6a22e8d9a5644b1e27622aa00d5e1af594702) Thanks [@fraxken](https://github.com/fraxken)! - Cut editor boot time by stopping the client from re-uploading its whole
  placeholder atlas on every load, resuming asset replay from the last snapshot
  checkpoint, and letting rooms resolve without blocking one another.

- [#594](https://github.com/JollyPixel/editor/pull/594) [`4ad1299`](https://github.com/JollyPixel/editor/commit/4ad12991dc15ff5bb2ac158f9d6d6b0ce6023fd4) Thanks [@fraxken](https://github.com/fraxken)! - Projections load from each asset's newest checkpoint, and opening a workspace compacts superseded events, so startup no longer grows with the log.

### Patch Changes

- [#611](https://github.com/JollyPixel/editor/pull/611) [`402c2d9`](https://github.com/JollyPixel/editor/commit/402c2d952e774d2c96ead24b7c8d11ef568128a9) Thanks [@fraxken](https://github.com/fraxken)! - Persistence factories take an optional schema map and reject unknown or mismatched events on append. Both backends are faster.

- [#628](https://github.com/JollyPixel/editor/pull/628) [`423db10`](https://github.com/JollyPixel/editor/commit/423db105df46e6ec7bb692beec0a37b1f9332fad) Thanks [@fraxken](https://github.com/fraxken)! - The extension hooks `onClientConnect`, `onClientDisconnect` and `onMessage` are optional; implementations need the `override` modifier.
- Updated dependencies [[`18842ab`](https://github.com/JollyPixel/editor/commit/18842abe5ad347f63eacf8254d0685cba235adee), [`d6f6a22`](https://github.com/JollyPixel/editor/commit/d6f6a22e8d9a5644b1e27622aa00d5e1af594702), [`c9fa209`](https://github.com/JollyPixel/editor/commit/c9fa2090fc08b3151f107290459dbd050a584186), [`402c2d9`](https://github.com/JollyPixel/editor/commit/402c2d952e774d2c96ead24b7c8d11ef568128a9), [`423db10`](https://github.com/JollyPixel/editor/commit/423db105df46e6ec7bb692beec0a37b1f9332fad), [`c5e4f38`](https://github.com/JollyPixel/editor/commit/c5e4f38bafbc56cfba7a5de5d5f66e3ed1cf6f65), [`02b3b44`](https://github.com/JollyPixel/editor/commit/02b3b44814abf14c24bfea237afababa6ff8b09c), [`a9a6ca8`](https://github.com/JollyPixel/editor/commit/a9a6ca8279097ff6e64a800f797a96ab21597e1b), [`402c2d9`](https://github.com/JollyPixel/editor/commit/402c2d952e774d2c96ead24b7c8d11ef568128a9), [`4ad1299`](https://github.com/JollyPixel/editor/commit/4ad12991dc15ff5bb2ac158f9d6d6b0ce6023fd4)]:
  - @jolly-pixel/asset@1.1.0
  - @jolly-pixel/event-store@3.0.0
  - @jolly-pixel/network@2.0.0
