# Binary frames

Status on 2026-11-07: network, asset-server and the model, sound and texture
snapshots carry raw bytes (uncommitted). A model open online reaches `ready`
about 400 ms sooner ([Measured gain](#measured-gain)). What is left is below.

An envelope that holds a `Uint8Array` travels as one binary frame instead of
base64 inside JSON text. The format, `bytesSchema` and the frame functions are
documented in [Messages](./docs/protocol/Messages.md#frames); the transports
in [InProcess](./docs/transport/InProcess.md) and
[WebsocketTransport](./docs/server/WebsocketTransport.md).

## Done

- Network 7.0.0: frame codec (`src/protocol/frame/`), `sendFrame`, binary
  frames on WebSocket, loopback, channel and data channel transports. Binary
  frames skip deflate unless `compression.binary` is set.
- Asset-server: the six catalog `content` fields and the `binaryCommands`
  snapshot (model, sound, texture) are `bytesSchema`. Stored events keep base64
  `AssetInlineContent`, so event stores and projects need no migration.
- `ModelFileDocument`, `SoundDocument` and the terrain editor's
  `TextureDocument` take the snapshot bytes as they arrive.

## Left to do

### 1. Deflate for model frames

The studio compresses text frames above 1 KB (`StudioBackend`,
`threshold: 1024`) and sends binary frames uncompressed. Deflate at level 3 on
the raw bytes (Node, median of 7):

- ToyCar GLB, 5.42 MB: 4.57 MB (15.7% saved), 114 ms deflate, 20 ms inflate.
- chime Ogg, 1.73 MB, and a 0.50 MB PNG: 0% saved, 42 and 18 ms spent.

Before this change the deflated base64 GLB frame was 4.86 MB, so a model open
now puts 0.56 MB more on the wire. On localhost that is free; on a slow link it
may cost more than the 114 ms deflate saves. `compression.binary` is all or
nothing, and turning it on would waste the Ogg and PNG time. Options: a
per-message hint from the extension (compress model snapshots only), or the
HTTP `ref` design below. Measure a model open with `--network fast-4g`
before choosing.

### 2. Kind packages, one change each

Each one replaces a base64 string field with `bytesSchema` in its own package.
Network needs no change.

- `@jolly-pixel/asset.pixel-art`: `pixelSnapshotSchema.pixels` (base64 or
  `{ format: "png", data }`). The voxel-map blockset reuses it for its atlas,
  which is why the studio turned text deflate on in October; revisit the
  threshold after this one.
- `@jolly-pixel/asset.terrain`: heights, holes and splat maps
  (`src/network/heights.ts`, `holes.ts`, `splat.ts`) and the part wire schema
  in `terrainAssetKind.ts`. Heights can wrap a `Float32Array` around the
  received view in the browser, where attachments are 8-byte aligned; Node
  gives no alignment guarantee.
- `SelectionPresenceCodec` (pixel-art) last. Its bytes would ride on
  `peer-presence` broadcasts, so small frequent updates become binary frames;
  measure before and after.

### 3. Later, separate designs

- Bytes out of stored events: events still hold base64, so every upload pays
  one encode and every fold one decode.
- HTTP `ref` content (`{ type: "ref", hash, size }`, already in
  `assetContentSchema`): the client fetches bytes from a content-addressed,
  cacheable route. It needs a route that applies room rights and share links,
  and an in-page path offline.

## Rules for the migrations

- Declare bytes with the exported `bytesSchema` instance. The Node validator
  recognizes that instance only; `z.instanceof(Uint8Array)` throws when its
  JSON Schema is built.
- A decoded `Uint8Array` is a view of the received frame and keeps the whole
  frame alive. Copy it (`slice()`) when a small part of a large frame is kept
  for long.
- Never transfer a frame's buffer through `postMessage`: one broadcast frame is
  shared by every member, and the offline shared tab uses `BroadcastChannel`,
  which cannot transfer.
- Size checks go through `encodedLength`, which counts bytes by `byteLength`.
- `Infer` (network) and `Immutable` (asset-server) leave `Uint8Array` as is;
  a new deep-readonly helper needs the same exemption.

## Measured gain

Interleaved A/B on 2026-11-07, 4 rounds, built studio on localhost:
`f998437c` served on port 3014 (control) against this change on 3004. Machine
in its fast state (first WebGPU adapter 90 ms). Results are in
`packages/studio/perf-results/ab-binary-2026-11-07.json` and
`ab-binary-sound-2026-11-07.json`. Median `ready`, in ms:

| Open | Phase | Control | Binary |
| --- | --- | --- | --- |
| model online | first | 812 | 497 (−315) |
| model online | reopen | 741 | 327 (−414) |
| model online | reload | 655 | 288 (−367) |
| model online | cold | 846 | 431 (−415) |
| sound online | reopen | 225 | 123 (−102) |
| sound online | reload | 234 | 124 (−110) |
| sound online | cold | 300 | 182 (−118) |

`settled` follows `ready` for model online (−306 to −434 ms). Socket payload
drops from 7.06 to 5.30 MB per model open and from 2.25 to 1.69 MB per sound
open. Offline opens move by 16 to 37 ms for model and within noise for sound.
Sound `settled` changed sign between the two runs (−205 to +230 ms), so it is
noise from one long frame, not a regression.
