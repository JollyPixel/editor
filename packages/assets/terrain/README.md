<p align="center">
  <img src="./docs/banner.png" alt="JollyPixel">
</p>

## 💃 Getting Started

This workspace-private package holds the terrain asset kind, its command
schemas, the server arbiter and the client sync. Its entry points are `.`
(kind, schemas and state helpers), `./client` (command document, preview, live
sender and receiver, history registration) and `./server`. See the terrain
editor [design][design] and [roadmap][roadmap].

## Storage and join

A terrain is stored as asset parts: `world.terrain.json` lists the chunks
with their overview samples, and `world.terrain.json.parts/<x>_<z>.bin` holds
the heights of each chunk, 64×64 little-endian `Float32`. The overview samples
are the four heights of the chunk's 32 m grid points, base64 encoded; loading
a chunk derives them from its heights. A chunk entry may also carry its heights
inline, base64 encoded, as a catalog create does; the first save after an
edit moves them to part files. Chunk coordinates lie within
`CHUNK_COORDINATE_RANGE`, -128 to 127 on each axis, and a terrain holds at
most `MAX_TERRAIN_CHUNKS`, 4096 chunks.

The room's snapshot is the chunk list. The document knows every chunk
through its overview samples and loads the heights of those its stream
follows. Call `document.stream.follow(centre)` when the camera enters another
chunk: the chunks within `STREAM_RADIUS`, 8 chunks, of the centre are
subscribed, nearest first, and loaded chunks farther than one more chunk are
unloaded. A chunk a peer adds loads if the stream reaches it.

`terrainDocumentKind()` wraps the room in `TerrainPartsRoom`, which sends
the stream's subscriptions and loads each part as it arrives. It holds a
snapshot, and the messages received after it, until the subscribed chunks in
it arrive. Members that have not subscribed to an edited chunk receive only
the tiles of `heights-patched` that hold its overview samples, which they
apply to the overview.

## Preview

`TerrainPreview` draws uncommitted heights over a `TerrainDocument`.
`preview.terrain` shows every layer: peers' live patches, written with
`write(peerId, patches)` and cleared with `drop(peerId)`, and the local stroke.
It emits `chunkAdded` and `chunkRemoved` when a chunk loads or unloads, and
`overviewChanged` when unloaded chunks change.

`beginStroke()` returns the local `TerrainStroke`; it throws while another
stroke is in progress. `stroke.terrain` shows the document with only this
stroke's tiles over it. `commit()` sends those tiles as `heights-patched`
commands of at most 1024 tiles each, the limit the room accepts, and returns
true when any of them is applied. Open a history step around the stroke so
they undo together. `end()` commits and ends the stroke, and `cancel()` drops
its tiles. Once `stroke.ended` is true, writes and commits do nothing.
`dispose()` commits a stroke in progress, then stops following the document
and emitting events.

## License

MIT

<!-- Reference-style links for DRYness -->

[design]: ../../editors/terrain/docs/design.md
[roadmap]: ../../editors/terrain/ROADMAP.md
