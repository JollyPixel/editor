# Collaboration

How terrain edits travel between users. It builds on the command flow shared
by every asset kind, described in the [assets architecture][assets-arch]:
the author applies an edit at once, the room arbitrates it, logs it and
broadcasts it, and a refused edit is answered with a correction.

## Commands

| Command | Content |
|---|---|
| `heights-patched` | Tile patches of height samples |
| `splatPatch` | Tile patches of splat indices and weights |
| `holePatch` | Tile patches of the hole mask |
| `chunk-added` | A chunk coordinate and its seeded heights |
| `chunk-removed` | A chunk coordinate |
| `setTier` | A chunk coordinate and its new tier |
| Layer and point-of-interest commands | Create, update, delete |

A patch is cut into 16×16 tiles; a chunk at ×1 has 4×4 of them. Each tile
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
- `streamRadius`: larger, set by the LoD. It decides which chunks are loaded.

What a peer receives about someone else's stroke depends on where it is:

| Peer | Receives |
|---|---|
| Near: presence region overlaps the edited chunks | Brush ring, live patches, commit |
| Far: chunks loaded, outside the presence radius | The commit only, applied when the stroke ends |
| Chunks not loaded | Nothing. The chunk's state arrives when the peer subscribes. |

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

- A kind handler declares parts: binary files under `<asset>/parts/`. For a
  terrain, one part per chunk.
- The join snapshot holds the manifest, the layers, the points of interest and
  the overview map. Chunks are not in it.
- A client sends `subscribeParts` and `unsubscribeParts` as its camera moves,
  and fetches the parts it subscribes to.
- The room broadcasts a command only to the peers subscribed to the parts it
  touches.
- The snapshot scheduler writes dirty parts one by one, and replay checkpoints
  are per part.

The client side of `@jolly-pixel/network`, `CommandSync` and the pending
ledger, does not change. `TerrainSyncClient` manages subscriptions from the
camera.

Until M2 lands, the server loads and sends the whole asset, and `chunk-added`
is refused past 256 chunks, about 17 MB of heights at ×1.

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

The room answers the author alone with a correction: the refused tiles with
their current values. Live patches are never corrected; the commit that
follows replaces them.

Until M2, a commit is refused whole, and the room answers with its full
snapshot instead of a tile correction.

## Undo

Each user has their own history, through `CommandHistory` from
`@jolly-pixel/history`. A stroke is one step. Undo sends the inverse patch as
a new command. If a peer has changed one of the stroke's tiles since, the undo
is refused, as for the other asset kinds.

Hole cuts and fills are patches like any other, so they undo the same way.
Since heights under a hole are kept, filling a hole restores the surface
exactly.

<!-- Reference-style links for DRYness -->

[assets-arch]: ../../../assets/ARCHITECTURE.md
