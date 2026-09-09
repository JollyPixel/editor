# Pixel-art asset kind

`@jolly-pixel/pixel-draw.renderer/asset/index.ts` supplies an
`AssetKindHandler` for `@jolly-pixel/asset-server`, so a pixel-art document
becomes a catalogued, event-sourced, persisted asset instead of a buffer held
in server memory.

```ts
import { FilesystemAssetSource } from "@jolly-pixel/asset-source";
import { pixelArtAssetHandler } from "@jolly-pixel/pixel-draw.renderer/asset/index.ts";

await createAssetBackend({
  source: new FilesystemAssetSource("./assets"),
  eventStore,
  handlers: [pixelArtAssetHandler({ defaultSize: { x: 32, y: 32 } })]
});
```

`@jolly-pixel/asset-server` and `@jolly-pixel/event-store` are optional peer
dependencies of this package. Import the subpath only from server code.

## How it differs from PixelSyncServer

| | `PixelSyncServer` | `pixelArtAssetHandler` |
|---|---|---|
| Buffer lifetime | process memory | replayed from the event log |
| Persistence | none | snapshotted to the asset source |
| Room id | fixed, passed as `id` | `pixelart:${assetId}`, resolved on join |
| Who writes the buffer | the extension | `apply`, folding appended events |

The wire protocol is identical, so `PixelSyncClient` and every presence sync
work unchanged against either. Use `PixelSyncServer` for a single ephemeral
canvas; use the asset kind when the document is a file people expect to still
be there tomorrow.

Both share `PixelCommandArbiter`, which resolves conflicts without touching a
buffer. That separation is what lets the asset room append rather than mutate.
`PixelSyncServer` calls `accept()`, which resolves and records in one step
because it applies the command immediately. The asset room calls `admit()`
and commits the returned arbitration only once the append lands, so a refused
append leaves no trace in the conflict trackers.

## The `.pixelart` document

The kind matches `**/*.pixelart` by default. The format itself, its codec and
the PNG seeding helper live in
[`Serialization`](../serialization/index.md) and ship from the package root,
so a browser can read a document without importing this subpath.

## `PixelArtState`

The fold target. It owns a `PixelBuffer` and delegates every format concern:

```ts
class PixelArtState {
  readonly buffer: PixelBuffer;

  constructor(size: Vec2);
  toJSON(): PixelArtDocumentData;
  load(document: PixelArtDocumentData): void;
  clear(): void;
}
```

`clear()` returns the buffer to the handler's `defaultSize` and drops every UV
region; it is what `ASSET_DELETED` folds to.

## The live protocol

`live()` returns the pixel-art half of an asset room; asset-server's
`AssetRoomExtension` owns the room lifecycle around it.

```ts
function live(
  binding: AssetRoomBinding<PixelArtState>
): AssetLiveProtocol<PixelNetworkCommand>;
```

It builds one `PixelCommandArbiter` per room, snapshots with
`pixelArtSnapshot()`, accepts `PIXEL_NETWORK_ACTIONS`, and appends admitted
commands under `PIXEL_ART_COMMAND`. Arbitration stamps the sender's
server-side `clientId` onto the command, so a spoofed id never reaches the
log.

## Why the room never writes

`apply` is the only writer. A room that mutated the buffer *and* appended
would apply every command twice, and live state would drift from a cold
replay. Pixel commands happen to be absolute writes that survive double
application, but relying on that would leave the kind one delta-carrying
command away from silent corruption.

## Errors

`apply` never throws. Its event is already persisted, so a fold that aborted
would break every later replay. A malformed document or command is logged and
skipped, leaving the last good buffer in place.

Commands the buffer could not apply are rejected by the arbiter before the
append, so a bad resize never reaches the log in the first place.
