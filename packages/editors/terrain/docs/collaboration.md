# Collaboration

How terrain edits travel between users. It builds on the command flow shared
by every asset kind: the author applies an edit at once, the room arbitrates
it, logs it and broadcasts it, and a refused edit is answered with a
correction.

## Commands

| Command | Content |
|---|---|
| `heights-patched` | Tile patches of height samples |
| `splat-patched` | Tile patches of splat indices and weights |
| `holePatch` | Tile patches of the hole mask |
| `chunk-added` | A chunk coordinate, its seeded heights and, when undoing a removal, its splat |
| `chunk-removed` | A chunk coordinate |
| `setTier` | A chunk coordinate and its new tier |
| `material-added` | A material, with its ID and slot |
| `material-updated` | A material ID and only the fields that changed |
| `material-removed` | A material ID |
| `texture-size-changed` | The terrain's material texture size |
| Point-of-interest commands | Create, update, delete |

A height patch is cut into 16×16 tiles and a splat patch into 32×32 texel
tiles, so a chunk at ×1 has 4×4 of each. Each tile
carries its chunk, its index in the chunk (`z × 4 + x`) and its new values. A
commit holds at most 1024 tiles. The author's document captures the values
the stroke replaced when it commits, and builds the inverse for undo from
them.

Height values travel as the raw bytes of a `Float32Array`, base64-encoded in
the JSON envelope, so they arrive exactly as written. Compression comes from
the WebSocket's permessage-deflate, enabled for terrain rooms; patches are not
compressed one by one.

### Collision keys

Each tile has the key `chunk:<x>,<z>:<channel>:<tile>`, where the channel is
`h`, `s` or `x` (holes). `chunk-added` and `chunk-removed` hold the key
`chunk:<x>,<z>` and every tile key of their chunk, so undoing a chunk's
creation is refused once someone has sculpted it. Two commands collide when
they share a key. A collision resolves last write wins: the later command is
admitted and overwrites the tile.

Heights and splat use separate channels, so a peer painting a tile never
refuses another sculpting it, and the reverse.

`material-updated` holds `material:<id>:<field>` for each field it changes,
so two peers renaming a material and changing its tiling both land.
`material-added` and `material-removed` hold `material:<id>` and every field
key. An update that reaches the room after the material's removal is refused,
so a delete wins over a
concurrent update. `texture-size-changed` holds `terrain:texture-size`.

## Strokes

A stroke reaches peers in two tiers.

- **Live.** While the stroke runs, the author sends ephemeral tile patches
  every 100 ms, at most 1024 tiles per message. They are neither arbitrated
  nor logged. They only show the stroke as it happens, and the commit
  overwrites them.
- **Commit.** Arbitrated commands hold the tiles the stroke changed, at most
  1024 tiles per command, so a wide commit is split into several. A commit is
  sent when the stroke ends, and earlier during a long stroke: every 2 s, or
  once 4 chunks have been touched and at least 250 ms have passed since the
  last commit. That bounds how much a conflict can roll back. The 250 ms floor
  keeps a large brush, which touches 4 chunks in one frame, from committing
  every frame; it allows at most 4 such commits per second.

The event log records the commands of each commit, not the live patches.

## Proximity

Each client publishes its interest region: the chunk under its camera and two
radii.

- Presence radius: 4 chunks (`DEFAULT_PRESENCE_RADIUS`), at most 16. The
  region is the square of chunks within that many chunks of the centre on
  each axis.
- Stream radius: 8 chunks (`STREAM_RADIUS`), measured from the centre
  chunk as a circle. It decides which chunks are loaded; see
  [Streaming](#streaming).

What a peer receives about someone else's stroke depends on where it is:

| Peer | Receives |
|---|---|
| Near: presence region overlaps the edited chunks | Brush ring, live patches, commit |
| Far: chunks loaded, outside the presence radius | The commit only, applied when the stroke ends |
| Chunks not loaded | The commit's tiles that hold overview samples. The chunk's state arrives when the peer subscribes. |

The roster and camera frustums from `@jolly-pixel/editor.host` stay
room-wide.

### Routing

The brush ring is a presence value. Presence goes to the whole room, and each
client draws a peer's ring only inside its own interest region.

Live patches are messages to the terrain kind's server extension. The
extension forwards each one with `sendTo` to the peers whose presence region
overlaps the patch's chunks. `@jolly-pixel/network` does not change for this;
routing moves into it only if another kind needs it.

The extension is the terrain live protocol's relay (`TerrainLiveRelay`).
Each client sends its interest region to the relay as `interest-changed` when
its camera enters another chunk, and again after a resync. Live patches travel
as `live-patched`.

A peer draws live patches in a preview layer over its document and never
writes them into the document, so an undo or a rewind cannot keep them. A
commit to a tile clears the previews of that tile. A rewind or a reload of the
document keeps the previews on the chunks that still exist and drops the rest.
The author's preview is dropped when the author leaves, or when no commit
arrives within 5 s of its last live patch. The author's own stroke goes
through the same layer until it commits, and its live patches are the tiles
it writes there. A client runs one local stroke at a time. Its
`stroke.terrain` shows the document with only that stroke's uncommitted tiles
over it. Writes after the stroke ends are ignored, and tearing the preview
down commits a stroke still in progress.

## Asset parts

The asset server keeps one live state per asset, sends it whole on join and
writes it as one file. A large terrain does not fit that model, so V1 adds
asset parts to `@jolly-pixel/asset-server`:

- A kind handler declares parts: binary files in a folder beside the asset
  file, `<asset>.parts/`. For a terrain, two parts per chunk: its heights,
  `<x>_<z>`, and its splat, `<x>_<z>_splat`. A client subscribes to both. The
  chunk loads as soon as its heights arrive, painted with the overview's
  materials until its splat arrives; a splat that arrives first waits for
  the heights. A terrain saved before splat parts existed loads as Ground and
  writes them on its next save.
- The join snapshot holds the manifest, the materials, the points of interest and
  the overview map. Chunks are not in it.
- A client sends `subscribeParts` and `unsubscribeParts` as its camera moves,
  and fetches the parts it subscribes to.
- The room broadcasts a command only to the peers subscribed to the parts it
  touches.
- The snapshot scheduler writes only the dirty parts, then one checkpoint
  that names the latest version of every part, so replay starts from a single
  position.
- The server keeps every part of an open terrain in memory; streaming applies
  to the wire and to storage.

The [asset parts design][asset-parts] holds the server contract.

The client side of `@jolly-pixel/network`, `CommandSync` and the pending
ledger, does not change. `TerrainPartsRoom` sits between the room and the
synced document. It subscribes to the chunks the stream asks for, and holds a
snapshot back until the heights of the subscribed chunks in it arrive.

### Streaming

The document knows every chunk of the terrain through the overview map, and
holds heights only for the loaded ones. `TerrainDocument.stream`
decides which chunks are loaded.

- The editor calls `stream.follow(centre)` when its camera enters another
  chunk. Known chunks within the stream radius of the centre are subscribed,
  nearest first. Loaded chunks farther than the radius plus one are unloaded
  and unsubscribed, so a camera on a chunk border does not make them
  flicker.
- A view holds at most 256 chunk layers, the WebGPU default for texture
  arrays. A circle of 8 chunks holds about 200.
- A chunk loads when its part arrives, outside any snapshot. Unloading drops
  its heights and keeps its overview samples.
- A chunk a peer adds is loaded with the heights in `chunk-added`. The stream
  subscribes to it when it lies within the radius, and unloads it otherwise.
- The room sends `heights-patched` whole to the members subscribed to its
  chunks. The others receive `outside(command)`: the same command cut down to
  the tiles that hold overview samples, tiles 0, 2, 8 and 10 of each chunk,
  or nothing when no such tile changed. `splat-patched` is cut the same way,
  since the same tile indices hold the overview's dominant materials. A client
  applies the tiles of an unloaded chunk to its overview only. `chunk-added`,
  `chunk-removed` and the material commands go to every member.
- A chunk without a part reply yet, or unloaded while it has pending
  commands, stays consistent: the reply carries the heights at its version,
  and a pending patch replayed on an unloaded chunk updates the overview.

`chunk-added` is refused past 4096 chunks, and commands naming a chunk
outside `[-128, 127]` do not parse; see [World and chunks][world].

## Corrections

A collision alone never refuses a commit, since the later one wins. A commit
is refused, in whole or in part, when:

- a tile's chunk was removed in the meantime;
- a tile's chunk changed tier, so the patch no longer matches its grid;
- a tile holds a height that is not finite or lies outside `[-4096, 4096]` m;
- the author lacks the right to edit the terrain.

Rights go through the room's existing rights gate on the terrain command
event, as for the other kinds, and refuse the whole commit. There are no
per-chunk rights in V1.

Since each sample belongs to one chunk, a refused tile cannot leave two
copies of an edge out of step.

The room admits the tiles that pass and answers the author alone with a
correction: the refused tiles with their current values, as a
`heights-patched` under the author's sequence number, so the author's
pending commit settles without a snapshot. A refused tile whose chunk is gone
has no value to send; the author drops it when the `chunk-removed` reaches
it. When no refused tile has a value, the correction is the admitted part of
the commit, or, when nothing was admitted, the `chunk-removed` of a missing
chunk: both change nothing on the author's side. Live patches are never
corrected; the commit that follows replaces them.

A tile is also refused when a newer commit already wrote it, which
last-write-wins resolves per tile. `chunk-added` and `chunk-removed` are
still refused whole, and answered with the room's snapshot.

## Undo

Each user has their own history, through `CommandHistory` from
`@jolly-pixel/history`. A stroke is one step. Undo sends the inverse patch as
a new command. If a peer has changed one of the stroke's tiles since, the undo
is refused, as for the other asset kinds.

A step whose chunks are unloaded is skipped the same way, since the client
cannot check their current heights. A step no undo tried meanwhile is
available again once its chunks load with the same heights.

A paint stroke is one step as well. Its undo is refused only when a peer has
painted one of its splat tiles since; sculpting there does not count.

Hole cuts and fills are patches like any other, so they undo the same way.
Since heights under a hole are kept, filling a hole restores the surface
exactly.

<!-- Reference-style links for DRYness -->

[asset-parts]: ../../../asset-server/architecture/AssetParts.md
[world]: ./design.md#world-and-chunks
