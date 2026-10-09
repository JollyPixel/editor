# Animation bindings

Exported from `@jolly-pixel/asset.voxel-model/client`. A model plays animation set assets from [`@jolly-pixel/asset.voxel-animation`](../../voxel-animation/README.md) through links. A set's tracks target blocks by name path, so one set can play on every model sharing a hierarchy; a link adjusts that for one model.

```ts
import { ClipSampler } from "@jolly-pixel/asset.voxel-animation/client";
import {
  BlockTransform,
  TrackBinding
} from "@jolly-pixel/asset.voxel-model/client";

// model is a ModelDocument, animations an AnimationDocument of a linked set
const link = model.tree.animationSets.get(animationSetId)!;
const clip = animations.set.clip(clipId)!;
const binding = new TrackBinding(clip.tracks.map(({ path }) => path), link, model.tree);
const sampler = new ClipSampler(clip);

for (const [path, sample] of sampler.sample(tick)) {
  const blockId = binding.get(path)?.blockId;
  if (blockId) {
    const rest = model.tree.block(blockId)!.transform;
    const posed = new BlockTransform(rest).pose(sample);
  }
}
```

## Links

| Method | Description |
|---|---|
| `linkAnimationSet({ id, kind }, { own? }?)` | Links a set with no track remapped. `own: true` makes it the model's own set, the one holding the clips made for this model; refused when the model already owns one. |
| `shareAnimationSet(id)` | Turns the own set into a plain linked one. |
| `unlinkAnimationSet(id)` | Removes a link. |
| `remapAnimationTrack(id, path, target)` | Points the track `path` of a linked set to another block path, or ignores it on this model with `null`. |
| `clearAnimationTrackRemap(id, path)` | Drops a remap, so the track binds by its own path again. |

Each method returns `false` when the model refuses the command. Every linked set is a catalog dependency of the model.

`document.tree.animationSets` reads the links:

| Member | Description |
|---|---|
| `size`, `has(id)`, `get(id)`, `values()` | The links, as `AnimationSetLinkJSON` `{ id, kind, bindings, own? }`. |
| `binding(id, path)` | A link's remap of a track path, or `undefined`. |
| `owned` | The link marked `own`, if any. |

## Block paths

`blockPathOf(tree, id)` is a block's path: the names of its block ancestors and its own, joined by `/`, folders left out, so moving a block between folders keeps its path. Paths compare as a `TrackPath`: segment by segment, trimmed and in any case. A name holding `/` cannot be told apart from a path.

## `TrackBinding`

```ts
new TrackBinding(
  paths: Iterable<string>,
  link: AnimationSetLinkJSON,
  tree: ModelTreeReader
)
```

Resolves each track path to a `TrackResolution` `{ state, blockId, remap }`. A remap first replaces the path by its target. The track is then:

| `state` | When |
|---|---|
| `bound` | Exactly one block has the path. `blockId` is that block. |
| `ambiguous` | Several sibling blocks share a name on the path. |
| `missing` | No block has the path. |
| `ignored` | The link remaps the track to `null`. |

`remap` is the link's remap of the track, or `null`. A remap targets a path rather than a block ID, so it reconnects to a block deleted and made again under the same name.

| Member | Description |
|---|---|
| `get(path)` | The resolution of one track. |
| `[Symbol.iterator]()` | `[path, resolution]` pairs, in the order of `paths`. |
| `bound()` | The bound tracks, as a path-to-block-ID map. |
| `pathOf(blockId)` | The track that drives a block: a bound track among `paths`, else the track a remap points at the block's path, else `blockPathOf`. |

## Posing

`new BlockTransform(rest)` holds a block's rest transform. `pose(sample)` applies an `AnimationSample`: position adds to the rest, rotation adds per axis in degrees, and scale multiplies it. A channel the sample lacks keeps its rest value. `deltaTo(pose)` is the reverse: the full sample that poses the rest transform into `pose`. A scale axis resting at 0 keeps a factor of 1.
