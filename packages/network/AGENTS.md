# AGENTS.md

## Byte payloads

- Declare bytes with the exported `bytesSchema` instance. The Node validator
  recognizes only that instance; building the JSON Schema of
  `z.instanceof(Uint8Array)` throws.
- A decoded `Uint8Array` is a view of the received frame and keeps the whole
  frame alive. Copy it with `slice()` before keeping a small part of a large
  frame for long.
- Never transfer a frame's buffer through `postMessage`. The server sends one
  broadcast frame to every member, and `BroadcastChannel`, used by the offline
  shared tab, cannot transfer.
- Measure sizes with `encodedLength`, which counts a `Uint8Array` by its
  `byteLength`.
- `Infer` leaves `Uint8Array` mutable. A new deep-readonly helper needs the
  same exemption.
- Hint `compress` only for bytes that shrink, such as raw pixels, glTF or
  height maps. Never hint it for PNG, Ogg or other compressed media.
