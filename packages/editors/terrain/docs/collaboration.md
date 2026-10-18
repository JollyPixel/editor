# Collaboration

How terrain edits travel between users. It builds on the command flow shared
by every asset kind, described in the [assets architecture][assets-arch]:
the author applies an edit at once, the room arbitrates it, logs it and
broadcasts it, and a refused edit is answered with a correction.

## Commands

| Command | Content |
|---|---|
| `heightPatch` | Tile patches of height samples |
| `splatPatch` | Tile patches of splat indices and weights |
| `holePatch` | Tile patches of the hole mask |
| `addChunk`, `removeChunk` | A chunk coordinate |
| `setTier` | A chunk coordinate and its new tier |
| Layer and point-of-interest commands | Create, update, delete |

A patch is cut into 16×16 tiles. Each tile carries its chunk, its position in
the chunk, the new values and the previous ones. The previous values make the
inverse for undo and the correction for a refusal.

Patches are deflate-compressed on the wire.

### Collision keys

Each tile has the key `chunk:<x>,<z>:<channel>:<tile>`, where the channel is
`h`, `s` or `x` (holes). Two commands collide when they share a key. A
collision resolves last write wins: the later command is admitted and
overwrites the tile.

## Strokes

A stroke reaches peers in two tiers.

- **Live.** While the stroke runs, the author sends ephemeral tile patches
  every 100 ms. They are neither arbitrated nor logged. They only show the
  stroke as it happens, and the commit overwrites them.
- **Commit.** One arbitrated command holds the tiles the stroke changed. It is
  sent when the stroke ends, and earlier during a long stroke: every 2 s, or
  once 4 chunks have been touched. That bounds how much a conflict can roll
  back.

The event log records one command per commit, not one every 100 ms.

## Proximity

Each client publishes its interest region: the chunk under its camera and two
radii.

- `presenceRadius`: 4 chunks by default, set in the view settings.
- `streamRadius`: larger, set by the LoD. It decides which chunks are loaded.

What a peer receives about someone else's stroke depends on where it is:

| Peer | Receives |
|---|---|
| Near: presence region overlaps the edited chunks | Brush ring, live patches, commit |
| Far: chunks loaded, outside the presence radius | The commit only, applied when the stroke ends |
| Chunks not loaded | Nothing. The chunk's state arrives when the peer subscribes. |

The roster and camera frustums from `@jolly-pixel/editor.host` stay
room-wide.

### Network change

Today the presence channel forwards every value to the whole room. V1 adds
routing by interest region to `@jolly-pixel/network`: presence values and
ephemeral messages that carry chunk coordinates go only to the peers whose
presence region contains them.

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

Until M2 lands, the server loads and sends the whole asset.

## Corrections

A collision alone never refuses a commit, since the later one wins. A commit
is refused, in whole or in part, when:

- a tile's chunk was removed in the meantime;
- a tile's chunk changed tier, so the patch no longer matches its grid;
- the author lacks the right to edit the terrain.

The room answers the author alone with a correction: the refused tiles with
their current values. Live patches are never corrected; the commit that
follows replaces them.

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
