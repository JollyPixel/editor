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

A terrain is stored as asset parts: `world.terrain.json` lists the chunks,
and `world.terrain.json.parts/<x>_<z>.bin` holds the heights of each chunk,
64×64 little-endian `Float32`. A chunk entry may also carry its heights
inline, base64 encoded, as a catalog create does; the first save after an
edit moves them to part files.

The room's snapshot is the chunk list. `terrainDocumentKind()` wraps the room
in `TerrainPartsRoom`, which subscribes to every chunk of a snapshot and
holds the snapshot, and the messages received after it, until those chunks
arrive. The document then loads the full terrain, followed by the held
messages. Until camera-driven loading lands, the room sends every terrain
command to every member.

## Preview

`TerrainPreview` draws uncommitted heights over a `TerrainDocument`.
`preview.terrain` shows every layer: peers' live patches, written with
`write(peerId, patches)` and cleared with `drop(peerId)`, and the local stroke.

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
