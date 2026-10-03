---
status: accepted
---

# Companions are derived from names and dependency edges

Some assets belong to another one: a map's tileset, a model's texture. The user keeps them where
they like, so the studio cannot rely on a folder per kind; the seed puts each pair side by side
(`maps/overworld.voxelmap.json` and `maps/overworld.tileset.json`).

An asset is a companion of its owner when both sit in the same folder, share the name before the
first dot, and the owner references it through a catalog dependency edge. The tree nests a
companion under its owner, and the owner row has no expand toggle, so its companions always show;
a kind filter that shows the owner shows its companions too.
Renaming the owner renames its companions to the new name, keeping their extensions; moving it
moves them. A companion renamed or moved alone simply stops being paired. Deleting an owner lists
its companions with a checkbox, on by default.

Pairing is one level deep. An asset referenced by two same-named assets, or two assets referencing
each other, pair with nothing. A tileset shared by several maps pairs only with the one with its
name; moving it never breaks the others, since references are ids, not paths.

An asset created from the shell without content gets its companions from the back-end: the kind
handler lists the companion kinds, and the writer creates each one beside the new asset, same
name, and links it before writing the owner. The pair exists from the start, and a taken name
suffixes owner and companions together.

The tree refuses a rename or a move whose target path, companions included, is already taken,
before sending any catalog command. [ADR-0010](./0010-folders-live-in-the-asset-source.md) still
holds for failures the back-end reports half way.

## Considered Options

- **Same name only.** Groups unrelated assets that happen to share a name.
- **Every referenced asset.** A shared tileset would follow whichever map moved last.
- **A collapsible owner.** The first version: a companion vanished under a collapsed owner,
  and under a kind filter that hid its own kind.
- **Companions listed beside their owner, with a "companion of" detail.** Loses the grouping
  and adds noise to every companion row.
- **Relations stored in the catalog or a sidecar.** A second source of truth beside the paths
  and the edges.
