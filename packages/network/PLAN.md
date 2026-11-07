# Binary frames: what is left

Binary frames, the compress hint and the byte migrations are committed. HTTP
content refs for model and sound are built and not yet committed. The frame
format is in [Messages](./docs/protocol/Messages.md#frames); content refs are
described in the asset-server `RoomsAndReconciliation.md`.

## Content refs

- Replaced content reaches the members already in the room inline, through
  `snapshot()`; only the next join gets a ref. Refreshing the encoded snapshot
  before the reload broadcast would send them a ref too, but a member still
  fetching the old ref then gets a 404 and falls back to the socket.
- Sound refs cost about 200 ms on a throttled first or cold open: Ogg does not
  compress, so the fetch adds a round trip without saving bytes. Reopen and
  reload save 1.7 s. Decide whether to keep `refAbove` at 256 KiB, raise it,
  or keep sound inline.
- Texture stays inline, as its snapshots are mostly small PNGs. Opt it in only
  if large textures become common.

## Stored inline content as bytes

`AssetInlineContent` stays base64 in stored events. The event store `$bytes`
tag and an upcast in `parseAssetEvent` would make it bytes, but SQLite would
still store base64 inside the event store. Measure first; a BLOB column or
storing a ref would remove it.

## Rules for byte payloads

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
