---
"@jolly-pixel/network": major
---

Envelopes holding a `Uint8Array` travel as binary frames (`bytesSchema`, `encodeFrame`, `decodeFrame`) instead of JSON text; binary frames skip deflate unless `compression.binary` is set.
`ClientConnection.sendSerialized(json)` becomes `sendFrame(frame)` and `ClientSocket.send` takes `string | Uint8Array`. `DataChannelPort` sends only binary chunks, so `DataChannelLike.send` takes a `Uint8Array` (and the channel needs `binaryType`), and `chunkLength` (bytes) replaces `frameLength`.
