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

The slot's asset kind is `voxelmap`. `create()` returns `null` while the slot
is empty. Otherwise it adds a `VoxelRenderer` drawing `document`, which stays
with the source, and calls `attach()` with the renderer's view. The source
loads the map's blockset atlases into that view and keeps them current. The
function `attach()` returns runs when the component is destroyed.

One source can serve several views at once.
