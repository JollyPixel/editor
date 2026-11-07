# Binary frames

Status on 2026-11-07: binary frames (`9a805e5fa`) and the compress hint with
the snapshot and part migrations (`033a975db`) are committed. Socket
compression by deployment, bytes in stored events and commands, the terrain
manifest split and selection presence are built (uncommitted). HTTP `ref`
content is left. The throttled model deflate rows were rerun with the fixed
proxy ([Model deflate](#model-deflate)).

An envelope that holds a `Uint8Array` travels as one binary frame instead of
base64 inside JSON text. The format, `bytesSchema` and the frame functions are
documented in [Messages](./docs/protocol/Messages.md#frames); the transports
in [InProcess](./docs/transport/InProcess.md) and
[WebsocketTransport](./docs/server/WebsocketTransport.md).

## Done

- Network 7.0.0: frame codec (`src/protocol/frame/`), `sendFrame`, binary
  frames on every transport.
- Compress hint: `SendOptions { compress }` on `RoomBroadcast.broadcast` /
  `sendTo`, `ClientHandle.send` and `ClientConnection.sendFrame`, carried
  across worker extensions. WebSocket deflates a binary frame only when it is
  hinted; `compression.binary` is gone.
- Asset-server: catalog `content` and the `binaryCommands` snapshot are
  `bytesSchema`; stored events keep base64 `AssetInlineContent`.
  `compressSnapshot` hints the plain `snapshot()` form (never
  `encodeSnapshot()`), `parts.compress` hints `parts` messages,
  `binaryCommands(type, { compress })` sets it. Model compresses; sound and
  texture do not.
- Terrain parts are compressed raw bytes. Heights parts that arrive while a
  snapshot waits are re-encoded to base64 for the manifest.
- Pixel-art and blockset snapshots: `pixels` is bytes or
  `{ format: "png", data: bytes }`; the plain form (`pixelWireSnapshot`) is
  compressed, the PNG form is not. The file keeps base64.
- `studio/perf/throttleProxy.ts`: a TCP proxy that throttles a link without
  the CDP bias against uncompressed frames.
- Socket compression by deployment: `StudioBackend.attach({ compression })`
  defaults to off; `start.ts` turns it on unless `JOLLY_SOCKET_COMPRESSION=false`;
  `perf/serveBuild.ts --compression` serves the hosted variant.
- Event store: `eventData` keeps `Uint8Array` values as `{ "$bytes": base64 }`
  in SQLite and the memory log, raw in IndexedDB. `$bytes` is reserved.
- Asset-server: `AssetCommands.upcast` rewrites stored commands of an older
  shape before fold and resume; `AssetLiveProtocol.compressCommands` hints
  broadcast commands and catch-ups.
- Pixel `texture-replaced` (pixel-art and blockset) and terrain
  `chunk-added`, `tier-changed`, the three tile patches and `live-patched`
  carry bytes; their upcasts decode the base64 already stored. Pixel-art,
  blockset and terrain hint `compressCommands`.
- Terrain manifest: the wire `chunkEntrySchema` holds bytes, the
  `.terrain.json` file keeps base64 through `terrainFile` /
  `terrainFileManifest`, and `TerrainPartsRoom` no longer re-encodes heights.
  The manifest snapshot is compressed.
- Selection presence: masks and moving pixels are bytes
  ([Selection presence](#selection-presence)).

## Left to do

In order.

### 1. HTTP `ref` content

`{ type: "ref", hash, size }`, already in `assetContentSchema`: the client
fetches bytes from a content-addressed, cacheable route. Start with a spike:

- Route `GET …/assets/<assetId>/content/<hash>` next to `catalogHandler.ts`,
  `Cache-Control: private, max-age=31536000, immutable`, 404 for a hash that
  is no longer current, after which the client falls back to the socket.
- Rights through a hook the studio supplies: `accounts.signedIn(headers)` and
  room rights for accounts, `StudioShares.admits` for guests. Check first how a
  share-link guest identifies over plain HTTP.
- A kind opts in (`binaryCommands(type, { ref: true })` above a size); the
  sync client resolves `ref` through an injected resolver, which the in-page
  `AssetServer` implements offline.
- Measure model reopen and reload: a cache hit should drop the 5.3 MB, a cold
  open pays one more round trip.

### Later

- Stored `AssetInlineContent` as bytes: the event store tag and an upcast in
  `parseAssetEvent` would do it, but SQLite would still base64 inside the
  event store. Measure first; a BLOB column or `ref` storage removes it.

## Rules for the migrations

- Declare bytes with the exported `bytesSchema` instance. The Node validator
  recognizes that instance only; `z.instanceof(Uint8Array)` throws when its
  JSON Schema is built.
- A decoded `Uint8Array` is a view of the received frame and keeps the whole
  frame alive. Copy it (`slice()`) when a small part of a large frame is kept
  for long, or when the receiver mutates it: a loopback frame can reach
  several peers in one process.
- Never transfer a frame's buffer through `postMessage`: one broadcast frame is
  shared by every member, and the offline shared tab uses `BroadcastChannel`,
  which cannot transfer.
- Size checks go through `encodedLength`, which counts bytes by `byteLength`.
- `Infer` (network) and `Immutable` (asset-server) leave `Uint8Array` as is;
  a new deep-readonly helper needs the same exemption.
- Hint `compress` only for bytes that shrink (raw pixels, glTF, height maps),
  never for PNG, Ogg or other compressed media.

## Measurements

### Selection presence

Microbenchmark on 2026-11-07, Node 24.18: one moving selection encoded by
`encodeSelectionPresence`, framed in a `presence` envelope by `encodeFrame`,
then decoded by `decodeFrame` and `decodeSelectionPresence`. Mean of 200
rounds (20 at 512²):

| Selection | base64 frame | bytes frame | base64 time | bytes time |
| --- | --- | --- | --- | --- |
| 32×32 | 5.8 KiB | 4.4 KiB | 0.31 ms | 0.17 ms |
| 128×128 | 88.3 KiB | 66.3 KiB | 5.1 ms | 4.9 ms |
| 512×512 | 1408 KiB | 1056 KiB | 82 ms | 62 ms |

Most of the remaining time builds and reads the `RGBA8` objects, not the
bytes.

### Model deflate

Interleaved A/B on 2026-11-07, 4 rounds, model online, one built studio served
twice: port 3004 as built (`deflate`) and port 3014 with socket compression
off (`raw`). The `-4g` variants reach them through `throttleProxy.ts` at
8.1 Mbit/s and 165 ms RTT. Results are in
`packages/studio/perf-results/ab-deflate-2026-11-07.json`. Median `ready`, in
ms:

| Phase | raw | deflate | raw-4g | deflate-4g |
| --- | --- | --- | --- | --- |
| first | 779 | 942 (+163) | 7295 | 6756 (−539) |
| reopen | 420 | 727 (+307) | 6454 | 5957 (−497) |
| reload | 444 | 716 (+272) | 6401 | 5974 (−427) |

`settled` moves the same way. The GLB deflates from 5.30 to 4.57 MB (Node,
level 3), which is about 720 ms at 8.1 Mbit/s; the measured saving of about
500 ms leaves the 300 ms that deflate costs on localhost. Two of the four
`deflate-4g` reloads took the time of one more full transfer (11653 and
11652 ms): the proxy then kept a closed socket's queued bytes on the link. The
harness counts decoded socket bytes (5296 KB in every variant), not wire bytes.

Rerun of the `-4g` variants on 2026-11-07 with the fixed proxy, which drops a
closed socket's queued bytes: 5 interleaved rounds, built from this branch,
`serveBuild --compression` on 3004 and plain `serveBuild` on 3014. Results are
in `packages/studio/perf-results/ab-deflate-4g-2-2026-11-07.json`. Median
`ready`, in ms:

| Phase | raw-4g (n=5) | deflate-4g (n=4) |
| --- | --- | --- |
| first | 7698 | 6922 (−776) |
| reopen | 6387 | 5763 (−624) |
| reload | 6341 | 5731 (−610) |

`settled` moves by −612 to −738 ms. No reload repeated a transfer: every
`deflate-4g` reload took 5686 to 5769 ms, and the 3 of an earlier run
(`ab-deflate-4g-2026-11-07.json`) 5735 to 5765 ms. One `deflate-4g` round
was lost to a harness timeout: the shell's asset tree took over 30 s to show
through the proxy. The earlier run lost more rounds the same way, plus the
first open on each server, which uploads the 5.4 MB GLB through the proxy;
seed both servers before a throttled run.

### Binary frames

Interleaved A/B on 2026-11-07, 4 rounds, built studio on localhost:
`f998437c` (base64 in JSON, control) against binary frames, before the compress
hint, so model frames were not deflated. Results are in
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
