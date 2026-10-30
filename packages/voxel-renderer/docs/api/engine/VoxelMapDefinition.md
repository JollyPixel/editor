# VoxelMapDefinition

The `VoxelMap` component type for `@jolly-pixel/engine` scene files. It draws
a voxel map, read from the entry's `map` asset slot, through a
[`VoxelRenderer`](./VoxelRenderer.md).

```ts
import { Systems } from "@jolly-pixel/engine";
import { VoxelMapDefinition } from "@jolly-pixel/voxel.renderer/engine";

const components = new Systems.ComponentDefinitions().register(
  new VoxelMapDefinition()
);
```

## Data

```ts
interface VoxelMapSettings {
  castShadow: boolean;
  receiveShadow: boolean;
  layers: Readonly<Record<string, boolean>>;
}
```

`castShadow` and `receiveShadow` default to `false` and set the same flags on
`view.lighting`. `layers` maps a layer name to a visibility that overrides the
map's own; a layer left out keeps the map's value. A missing or mistyped field
falls back to its default, and a non-boolean layer entry is dropped.

`apply()` patches a live component: it sets both shadow flags and replaces the
layer overrides.

## Map slot

```ts
const VOXEL_MAP_ASSET: AssetType<VoxelMapSource>;

interface VoxelMapSource {
  readonly document: VoxelDocument;
  attach(view: VoxelView): () => void;
}
```

The slot's asset kind is `voxelmap`.

- `create()` returns `null` while the slot is empty. Otherwise it adds a
  `VoxelRenderer` drawing `document`, which stays with the source.
- It then calls `attach()` with the renderer's view. The source loads the
  map's blockset atlases into that view and keeps them current.
- The function `attach()` returns runs when the component is destroyed.

One source can serve several views at once.

## Anchors

`anchors(renderer)` returns a `VoxelMapAnchors`, the engine's
`Systems.ComponentAnchors` for the map. A scene actor can then hang from a
layer or an object of the map and follow it.

Only what is marked as an anchor is listed: a layer with
[`anchor`](../world/VoxelLayer.md#options) set, and an object with
`anchor: true` (see [voxel objects](../world/VoxelWorld.md#voxel-objects)).

- A layer anchor has the kind `layer`, the key `layer:<layer id>`, and sits
  at the layer `position`, unrotated.
- An object anchor has the kind `object`, the key `object:<object id>`, and
  sits at the bottom centre of the footprint
  (`x + width / 2, y, z + height / 2`), turned by `rotation` degrees around Y.
- The label is the layer or object name.
- Listeners run on every layer or object command except voxel edits, and when
  the document loads.
- An object keeps its key when it moves to another object layer, so anchored
  objects need ids unique across object layers. The editor gives each object a
  UUID.

### `VoxelMapAnchorKey`

```ts
type VoxelMapAnchorKind = "layer" | "object";

class VoxelMapAnchorKey {
  static layer(id: string): VoxelMapAnchorKey;
  static object(id: string): VoxelMapAnchorKey;
  static parse(key: string): VoxelMapAnchorKey | null;

  readonly kind: VoxelMapAnchorKind;
  readonly id: string;

  toString(): string;
}
```

Reads and writes the anchor keys above. `parse()` returns `null` for a key
without a `layer` or `object` prefix, or with an empty id. The id is everything
after the first `:`.
