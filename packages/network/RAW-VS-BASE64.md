# Binary frames

Status: proposal, nothing built. Written 2026-11-07 from two studio A/B runs
(3 and 7 November 2026) and a read of the code at `d26da53c`.

Every byte of asset content that crosses the network today is base64 text
inside a JSON envelope. This plan lists what has to change so an envelope can
carry `Uint8Array` values as raw bytes instead.

## Why

Opening `ToyCar.glb` (5.4 MB) in the model editor:

- The asset room sends the snapshot as one 7.2 MB JSON frame.
- The studio enables permessage-deflate above 1 KB (`StudioBackend`,
  `threshold: 1024`). At the default level 3, Node takes 221 ms to deflate that
  frame to 4.86 MB, and 41 ms to inflate it.
- Online, the open reaches `ready` in 731 to 875 ms. Offline, where no socket
  is involved, it takes 276 to 509 ms. The boot step that waits for the
  snapshot (`host.session:target`) takes about 500 ms online and 157 ms offline.

The sound editor showed the same thing on 3 November: dropping deflate took
128 to 225 ms off an online open of a 2.1 MB snapshot on localhost. Turning
deflate off is not the fix, because over a real link it saves 25 to 33% of the
bytes. Deflate wins those bytes back from the base64 encoding itself.
Sending raw bytes removes that overhead.

The other costs are smaller but grow with every asset kind that carries
bytes: base64 encode on the server, `JSON.parse` of a multi-megabyte string,
and a decode back to bytes in the browser. On 7 November `decodeBase64` still
ran a validation regex over the whole string (73 to 81 ms per model open);
that part is fixed in `@jolly-pixel/utils` and no longer needs this refactor.

## What carries bytes today

In `@jolly-pixel/asset-server`:

- `AssetInlineContent` (`{ type: "inline", encoding: "base64", data: string }`
  in `model/events/AssetEvents.schema.ts`), encoded by `encodeContent` and
  decoded by `decodeContent` in `model/events/inlineContent.ts`.
- Binary kinds (model, sound) send it as their room snapshot through
  `binaryCommands`, with `assetInlineContentSchema` as the snapshot schema.
- The catalog protocol sends it for uploads, replacements and imports
  (`catalog/protocol.schema.ts`).
- Asset parts send each part as inline content (terrain chunks).
- Asset events store the same shape in the event store, so base64 is also the
  format at rest.
- `assetContentSchema` already has a `ref` variant (`{ hash, size }`) that
  nothing produces.

In kind packages, each with its own base64 field:

- `@jolly-pixel/asset.pixel-art`: `pixelSnapshotSchema.pixels` is a base64
  string or `{ format: "png", data }`. The voxel-map blockset reuses it for its
  atlas, which is why the studio turned deflate on in October.
- `@jolly-pixel/asset.pixel-art`: `SelectionPresenceCodec` puts selection
  masks in presence.
- `@jolly-pixel/asset.terrain`: heights, holes and splat maps.

## What network assumes today

Every layer passes strings:

| Layer | Where | Today |
|---|---|---|
| Client socket contract | `transport/ClientSocket.ts` | `send(data: string)` |
| Server connection contract | `server/connection/ClientConnection.ts` | `sendSerialized(json: string)` |
| Broadcast cache | `server/room/SerializedEnvelope.ts` | caches one `JSON.stringify` per broadcast |
| Envelope codec | `protocol/envelope/Envelope.ts` | `stringify` returns a string; `parseClient`, `parseServer` and `parseTrustedServer` parse strings with `secure-json-parse` or `JSON.parse` |
| WebSocket server | `transport/websocket/WebsocketTransport.ts` | `handle.receive(raw.toString())` turns a binary frame into text |
| WebSocket client | `transport/websocket/connectWebSocket.ts` | leaves `binaryType` at the browser default, `"blob"` |
| Channel transport | `transport/channel/ChannelMessage.ts`, `ChannelSocket.ts` | the `send` message schema has `data: z.string()` |
| WebRTC | `transport/channel/DataChannelPort.ts` | splits and joins messages as strings (`#outgoing: string[]`) |
| Loopback | `transport/loopback/LoopbackSocket.ts` | passes strings |
| Presence budget | `server/room/PeerPresence.ts` | measures `JSON.stringify(...).length` |

Worker extensions already work: `client.send` goes through `postMessage`,
which structured-clones a `Uint8Array`.

## Wire format

Keep text frames for envelopes without bytes, which is almost all traffic.
An envelope that holds at least one `Uint8Array` goes out as one binary frame:

```
u32 header length (little endian)
header: UTF-8 JSON of the envelope, each Uint8Array replaced by { "$bytes": i }
attachment 0
attachment 1
...
```

The header ends with an `attachments` array of byte lengths, so the decoder
can slice the frame without scanning it. The encoder collects the arrays with
a `JSON.stringify` replacer. The decoder parses the header and swaps each
placeholder for a `subarray` view of the received buffer, so no attachment is
copied.

The receiver knows a frame's format from the frame itself: a WebSocket frame
is text or binary, and a channel message is a string or a `Uint8Array`. No
flag is needed in the envelope.

MessagePack or CBOR would also work, but either adds a dependency and drops
`secure-json-parse`, which strips `__proto__` and `constructor` keys from
untrusted input. A JSON header keeps both the parser and every existing
schema.

## Changes by layer

### Protocol

- `Envelope.stringify` becomes `Envelope.encode`, returning
  `string | Uint8Array`.
- The three parsers accept `string | ArrayBuffer | Uint8Array`. A binary frame
  is malformed when its header length overruns the frame, a placeholder index
  has no attachment, or the attachment lengths do not add up to the frame.
- Room schemas need a bytes type. zod/mini has `z.instanceof(Uint8Array)`;
  check that the JIT `compile` path in `protocol/runtime/compiler.ts` accepts
  it before relying on it.

### Server

- `ClientConnection.sendSerialized` takes `string | Uint8Array`, and
  `SerializedEnvelope` caches whichever `encode` returned.
- `WebsocketTransport` keeps binary frames as bytes (`isBinary` on the `ws`
  message event) and sends with `{ binary: true }`.
- Compression becomes a per-message choice: `ws` takes `{ compress: false }`
  on each `send`. Text frames keep the current threshold. For binary frames,
  measure before picking a rule: a GLB holds uncompressed geometry and still
  shrinks, while Opus or PNG barely do.
- `PeerPresence` counts attachment bytes plus header length.
- Envelope logging prints a summary of a binary frame (header and attachment
  sizes), never its bytes.

### Client and transports

- `ClientSocket.send` takes `string | Uint8Array`, and `Client` passes binary
  data to the same parser.
- `connectWebSocket` sets `binaryType = "arraybuffer"`.
- `ChannelMessage` accepts a `Uint8Array` in `send` and `event` data. Offline,
  the page and the offline owner can list the attachment buffers in the
  `postMessage` transfer list, which removes the copy.
- `DataChannelPort` frames binary messages with its own chunk header, since an
  `RTCDataChannel` delivers strings and `ArrayBuffer`s on the same channel.
- `LoopbackSocket` passes values through unchanged.

### Asset server

- Add `{ type: "inline", encoding: "binary", data: Uint8Array }` to
  `AssetInlineContent`. `encodeContent` produces it for the wire, and
  `decodeContent` reads both variants.
- Keep base64 in stored events for now. Converting at the snapshot and
  protocol boundary leaves the event store and existing project files alone;
  moving bytes out of events is a separate change.
- `binaryCommands` snapshots, catalog uploads and asset parts switch to the
  binary variant.

### Kind packages

Pixel-art pixels, blockset atlases, selection presence and terrain codecs can
move one at a time once network and asset-server carry bytes. Each one is a
schema change in its own package and needs no change in network.

## Limits

`maxPayload` (the studio sets `MAX_CATALOG_MESSAGE_BYTES`) counts frame
bytes, so the same limit admits about a third more content once base64 is
gone. The per-kind upload limits (`maxContentBytes`) already count raw bytes
and do not change.

## Compatibility

A client and a server from before and after this change cannot talk once a
binary frame is sent: the old side parses it as text and drops it as
malformed. The studio ships both sides in one build, so it does not need
negotiation. `@jolly-pixel/network` is published, so this is a major version.
A connect-time capability flag would let a server fall back to base64 for old
clients, at the cost of keeping both encoders.

## Tests

- Envelope codec: round trip with zero, one and several attachments; each
  malformed case above rejected; a placeholder-shaped object in user data
  inside a text frame stays an object.
- One round trip per transport: WebSocket, loopback, channel and data channel.
- Server: one broadcast encodes once for every member, as `SerializedEnvelope`
  does today.
- asset-server: a binary kind's room snapshot reaches a second peer as bytes,
  and stored events still decode.

## Alternative: fetch bytes over HTTP

The unused `ref` content variant points at another design. The room snapshot
carries `{ type: "ref", hash, size }`, and the client fetches the bytes from a
content-addressed HTTP route. Those URLs never change, so the browser cache
answers a reopen without a transfer, and peers joining the room do not each
receive the bytes through the socket.

It costs an authenticated HTTP route that applies the same rights as the
asset room (share links included), and the offline mode, which has no HTTP
server, still needs an in-page path. It also leaves the kind packages'
base64 fields as they are. For large binary kinds it may be the better end
state; binary frames are the smaller step and cover every kind.

## Open questions

1. The placeholder key. Our encoder writes every `{ "$bytes": i }` itself,
   but a malicious client can put extra ones in a header, for example in a
   field whose schema allows any object. Rejecting a header whose placeholder
   count does not match `attachments` catches most of it; an escape rule for
   user objects with a `"$bytes"` key would close it.
2. Deflate policy for binary frames, to be measured on GLB, Opus and PNG
   content.
3. Whether to do the HTTP `ref` design for model and sound instead of, or
   after, binary frames.
