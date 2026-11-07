# Binary frames

Status on 2026-11-07: binary frames are on `main` (`9a805e5fa`). The compress
hint and the snapshot and part migrations are built (uncommitted). The model
deflate is measured: it costs about 300 ms on localhost and saves about 500 ms
on a fast-4g link ([Model deflate](#model-deflate)).

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

## Left to do

In order.

### 1. Socket compression by deployment

Deflate pays below about 20 Mbit/s and costs about 300 ms per model open above
it ([Model deflate](#model-deflate)). `StudioBackend` compresses every socket
(`threshold: 1024`), the local studio included. Turn compression off when the
studio serves loopback (`vite dev`, `dev:e2e`, a local `serveBuild`) and keep
it for the hosted `StudioServer`. Text frames lose little: the large ones were
base64 pixels, now hinted binary frames.

### 2. Bytes in stored events, then commands

Commands are stored as JSON (`event-store/src/persistence/EventRecord.ts`), so
a `Uint8Array` in a command would be saved as `{"0":…}`, and stored events hold
base64: every upload pays one encode and every fold one decode. Once the event
store keeps bytes (for example a tagged `{ "$bytes": base64 }` decoded on
read), move these commands to `bytesSchema`:

- pixel `texture-replaced` (`pixels`);
- terrain `chunk-added`, `tier-changed`, `heights-patched`, `splat-patched`,
  `holes-patched` and the `live-patched` relay.

Their schemas must still accept the base64 already stored. Check whether the
Node validator (`src/protocol/runtime/node.ts`) supports a string-to-bytes
transform before choosing how.

### 3. Terrain manifest

`overview`, `materials` and inline `heights` stay base64 because
`terrainFileSchema` extends `terrainManifestSchema`. Split the wire schema from
the file schema; that also removes the heights re-encode in
`TerrainPartsRoom`.

### 4. Selection presence

`SelectionPresenceCodec` (pixel-art) sends base64 masks and pixels. As bytes
they would ride on `peer-presence` broadcasts, so small frequent updates become
binary frames; measure before and after.

### 5. HTTP `ref` content

`{ type: "ref", hash, size }`, already in `assetContentSchema`: the client
fetches bytes from a content-addressed, cacheable route. It needs a route that
applies room rights and share links, and an in-page path offline.

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
11652 ms), and the reload median uses the two other rounds. The proxy then kept
a closed socket's queued bytes on the link, which delays the next open by the
rest of that transfer; it now drops them, so rerun the `-4g` reloads before
relying on that row. The harness counts decoded socket bytes
(5296 KB in every variant), not wire bytes.

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
