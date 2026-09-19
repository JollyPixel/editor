# Pixel-art asset kind

`@jolly-pixel/asset.pixel-art` supplies an
`AssetKindHandler` for `@jolly-pixel/asset-server`, so a pixel-art document
becomes a catalogued, event-sourced, persisted asset instead of a buffer held
in server memory.

```ts
import { FilesystemAssetSource } from "@jolly-pixel/asset-source";
import { pixelArtAssetKind } from "@jolly-pixel/asset.pixel-art";

await createAssetBackend({
  source: new FilesystemAssetSource("./assets"),
  eventStore,
  handlers: [pixelArtAssetKind({ defaultSize: { x: 32, y: 32 } })]
});
```

`@jolly-pixel/asset-server` is a package dependency. Import this entry point
only from server code.

## Live rooms

Each asset gets a `pixelart:${assetId}` room, resolved on join. The room
appends accepted commands to the event log; `commands.apply` is the only
writer of the buffer. An ephemeral canvas uses the same handler on a `MemoryAssetSource` and
a `persistence.memory()` event store.

`commands.live()` arbitrates through `PixelCommandArbiter.admit()`, which resolves
conflicts without touching the buffer. The room commits the returned
arbitration only once the append lands, so a refused append leaves no trace in
the conflict trackers.

## The `.pixelart` document

The kind claims every `.pixelart` path (`PIXEL_ART_EXTENSION`, also exported
from `network/client.ts` so editors build paths with it). The format itself,
its codec and
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
region; it is what `ASSET_DELETED` folds to through the handler's `clear`.
The handler's `load` decodes the stored bytes with `decodePixelArtDocument()`
before calling `load()`.

## The live protocol

`commands.live()` returns the pixel-art half of an asset room; asset-server's
`AssetRoomExtension` owns the room lifecycle around it.

```ts
function live(
  binding: AssetRoomBinding<PixelArtState>
): AssetLiveProtocol<PixelNetworkCommand>;
```

It builds one `PixelCommandArbiter` per room, snapshots with
`pixelArtSnapshot()` and appends admitted commands under `PIXEL_ART_COMMAND`.
`commands.protocol` is `pixelCommandProtocol`, the JSON Schema that validates
live messages and replay alike, and `pixelSnapshotSchema` describes the
snapshot. `commands.apply` forwards to `applyCommandToBuffer()`.

The arbiter enforces the rules a schema cannot express: a `select-edit` needs
as many colors as positions, and a created or changed UV region must pass
`isUVRegionData()`. The room has already replaced `clientId` with the sender's
server-side id, so a spoofed id never reaches the log.

## Why the room never writes

`commands.apply` is the only writer. A room that mutated the buffer *and* appended
would apply every command twice, and live state would drift from a cold
replay. Pixel commands happen to be absolute writes that survive double
application, but relying on that would leave the kind one delta-carrying
command away from silent corruption.

## Errors

A malformed document throws out of the fold before the buffer is touched.
`AssetStateStore` logs and skips it, so a replay continues from the last good
buffer.

Commands the buffer could not apply are rejected by the arbiter before the
append, so a bad resize never reaches the log in the first place.
