# Viewer

`@jolly-pixel/editor.voxel-map` exports a viewer that shows a voxel map
read-only in another editor. It has no write path: it never sends a command to
the map or to its blocksets. The package exports TypeScript sources from
`src/viewer/`, so only a bundler or `node` with type stripping can load it.

```ts
import { VoxelMapViewer } from "@jolly-pixel/editor.voxel-map";

const viewer = new VoxelMapViewer({
  assets: session.assets,
  catalog: session.catalog,
  mapId
});

const renderer = actor.addComponentAndGet(VoxelRenderer, {
  document: viewer.document
});
renderer.addTeardown(viewer.attach(renderer.view));

// Once no view draws the map
viewer.release();
```

## VoxelMapViewer

```ts
class VoxelMapViewer implements VoxelMapSource {
  static readonly kinds: readonly [VoxelMapDocumentKind, BlocksetDocumentKind];

  readonly document: VoxelDocument;
  readonly ready: Promise<void>;

  constructor(options: VoxelMapViewerOptions);
  attach(view: VoxelView): () => void;
  release(): void;
}

interface VoxelMapViewerOptions {
  assets: AssetLeases;
  catalog: BlocksetRecords;
  mapId: string;
}
```

The constructor leases the map, then one blockset per blockset the map links.
`ready` settles with the map lease. The blockset leases follow the map's
blockset commands and the catalog: a blockset is leased once its record
exists, and released when the map unlinks it.

`document` is the leased map's document. The viewer adds the blocks of every
leased blockset to it.

`attach(view)` loads each blockset's pixels into the view's atlases, and
reloads them when the pixels, the normal map or the tile size change. A
blockset leased later loads into every attached view. The returned function
detaches the view. Several views can draw one viewer.

`release()` releases the blockset leases, then the map lease.

Open at most one viewer per map in a session. The lease of a map is shared,
so two viewers of the same map would add its blocks twice.

## Document kinds

`VoxelMapViewer.kinds` lists the document kinds the viewer leases with. An
editor that shows maps puts them in its own `kinds`, because the host matches
a lease to its document kind by identity. The package also exports both
kinds as `VOXEL_MAP_DOCUMENT_KIND` and `BLOCKSET_DOCUMENT_KIND`.

## Scene component

`@jolly-pixel/editor.voxel-map/scene` exports `SCENE_COMPONENTS`, the
`SceneComponentPackage` that adds the `VoxelMap` component to the scene
editor. The manifest names it with `"jollypixel": { "scene": "./scene" }`.

It declares the `VoxelMap` component with its cast and receive shadow rows, a
"Voxel map" preset, and the `voxelmap` asset source. That source opens a
`SharedVoxelMaps` per editor session: one `VoxelMapViewer` per map, shared by
every component that shows it, and released a microtask after its last view
detaches, so a component rebuild keeps the lease. This also keeps to the one
viewer per map rule above.
