# Pixel-art asset kind

`@jolly-pixel/asset.pixel-art` supplies an
`AssetKindHandler` for `@jolly-pixel/asset-server`, so a pixel-art document
becomes a catalogued, event-sourced, persisted asset instead of a buffer held
in server memory.

```ts
import { FilesystemAssetSource } from "@jolly-pixel/asset-source";
import { pixelArtAssetHandler } from "@jolly-pixel/asset.pixel-art";

await createAssetBackend({
  source: new FilesystemAssetSource("./assets"),
  eventStore,
  handlers: [pixelArtAssetHandler({ defaultSize: { x: 32, y: 32 } })]
});
```

`@jolly-pixel/asset-server` and `@jolly-pixel/event-store` are package
dependencies. Import this entry point only from server code.

## Live rooms

Each asset gets a `pixelart:${assetId}` room, resolved on join. The room
appends accepted commands to the event log; `apply` is the only writer of the
buffer. An ephemeral canvas uses the same handler on a `MemoryAssetSource` and
a `persistence.memory()` event store.

`live()` arbitrates through `PixelCommandArbiter.admit()`, which resolves
conflicts without touching the buffer. The room commits the returned
arbitration only once the append lands, so a refused append leaves no trace in
the conflict trackers.

## The `.pixelart` document

The kind matches `**/*.pixelart` by default. The format itself, its codec and
the PNG seeding helper live in
[`Serialization`](../../../../pixel-draw-renderer/docs/serialization/index.md)
and ship from the renderer package root,
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
