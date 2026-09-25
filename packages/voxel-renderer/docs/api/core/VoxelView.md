# VoxelView

Draws a [`VoxelDocument`](./VoxelDocument.md). The view owns everything the
document does not: the `THREE.Group` holding the chunk meshes, the mesher, the
material cache, the atlas textures, the shape registry, the collider and the
inspector.

It subscribes to the document and keeps the meshes in step, so an application
edits the document and never tells the view what changed.

```ts
import {
  VoxelDocument,
  VoxelView,
  loadTilesets
} from "@jolly-pixel/voxel.renderer";

const document = new VoxelDocument({ layers: ["Ground"] });
const view = new VoxelView(document, {
  tilesets: await loadTilesets([
    { id: "default", src: "tileset.png", tileSize: 16 }
  ])
});

scene.add(view.root);
view.init();

// each frame
view.tick(deltaTime);
```

## VoxelViewOptions

```ts
interface VoxelViewOptions {
  /** Collision factory called once with the registries; disabled when omitted. */
  collider?: VoxelColliderFactory;
  /** @default "lambert" */
  material?: "lambert" | "standard";
  /** Called once for each new material with its tileset ID and surface. */
  materialCustomizer?: MaterialCustomizerFn;
  /** Shapes registered after the defaults from BlockShapeRegistry. */
  shapes?: BlockShape[];
  /** @default 0.1 */
  alphaTest?: number;
  logger?: VoxelLogger;
  inspector?: VoxelInspectorOptions;
  /** @default false */
  greedy?: boolean;
  /** Distant tiles fade to their average colour, see rendering and meshing. @default "average" */
  tileMinification?: "average" | "nearest";
  /** Preloaded atlases, see loadTilesets. */
  tilesets?: Iterable<TilesetSource>;
  /** @default 8 */
  rebuildBudgetMs?: number;
  /** @default Infinity */
  viewDistance?: number | ViewDistanceOptions;
  /** @default "hide" */
  viewDistancePolicy?: "hide" | "unload";
  /** @default false */
  retainVertexData?: boolean;
  /** @default false */
  castShadow?: boolean;
  /** @default false */
  receiveShadow?: boolean;
  /** 0 (off) to 1. @default 0 */
  ambientOcclusion?: number;
}
```

## Properties

```ts
class VoxelView {
  readonly root: THREE.Group;          // chunk meshes and inspector overlays
  readonly document: VoxelDocument;
  readonly shapes: BlockShapeRegistry;
  readonly tilesetManager: TilesetManager; // atlases over document.tilesets
  readonly inspector: VoxelInspector;

  greedy: boolean;                     // assigning rebuilds every chunk
  tileMinification: "average" | "nearest"; // assigning replaces the materials
  castShadow: boolean;                 // assigning updates built chunks
  receiveShadow: boolean;              // assigning updates built chunks
  ambientOcclusion: number;            // switching on or off rebuilds every chunk
  focus: THREE.Vector3Like | null;
  viewDistance: ViewDistance;
  viewDistancePolicy: "hide" | "unload";
  readonly pendingRebuilds: number;
}
```

The shape registry lives here, not on the document: a block's `shapeId` is
document state, but the shapes it names are code each client registers for
itself, and only the mesher, the collider and block previews read them.

Chunk meshes sit in a `"VoxelView:chunks"` group under `root`. A mesh outside
the view distance has `visible` set to `false`; the inspector's `"wireframe"`
mode hides the whole group.

## Methods

```ts
init(): void;                   // builds meshes for voxels already present
tick(deltaTime: number): void;  // rebuilds dirty chunks within the budget
flush(): void;                  // rebuilds every pending chunk now
whenIdle(): Promise<void>;       // see VoxelEngine.md#rebuild-budget
loadTileset(def: TilesetDefinition, texture: TilesetTexture): void;
load(data: VoxelWorldJSON, options?: VoxelViewLoadOptions): void;
markAllChunksDirty(source?: string): void;
dispose(): void;                // frees meshes, materials, textures, listeners
```

`loadTileset()` declares the tileset on the document *without* broadcasting a
command, then registers its atlas. An atlas loaded from outside the edit
stream is local to this client; use
[`VoxelDocument.addTileset()`](./VoxelDocument.md) to tell peers about one.

`load()` loads a snapshot into the document together with the atlases it
uses:

```ts
interface VoxelViewLoadOptions {
  mergeLayers?: boolean;
  tilesets?: Iterable<TilesetSource>; // atlases to register for the snapshot
}
```

Sources whose atlas is already loaded are ignored. The others are declared
with the snapshot and their textures registered before the world is meshed.

`dispose()` unsubscribes from the document and frees the view's own resources.
It leaves the document alone, since other holders may still be using it.

## What it does with each document signal

| document | view |
| --- | --- |
| `command`, tileset actions | re-syncs the atlases, invalidates their materials, marks every chunk dirty |
| `command`, `block-defined` / `block-removed` | marks every chunk dirty |
| `command`, material group actions | updates the group's materials, marks every chunk dirty when one is replaced |
| `loaded` | clears the meshes, re-syncs atlases, rebuilds everything |

Atlases are re-synced before the command reaches any other listener, so code
subscribed to the document reads a tileset that already matches it.
