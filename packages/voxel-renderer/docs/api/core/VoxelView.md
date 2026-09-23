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
  /** Called once for each new material with its tileset ID. */
  materialCustomizer?: MaterialCustomizerFn;
  /** Shapes registered after the defaults from BlockShapeRegistry. */
  shapes?: BlockShape[];
  /** @default 0.1 */
  alphaTest?: number;
  logger?: VoxelLogger;
  inspector?: VoxelInspectorOptions;
  /** @default false */
  greedy?: boolean;
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
}
```

## Properties

```ts
class VoxelView {
  readonly root: THREE.Group;          // container for all chunk meshes
  readonly document: VoxelDocument;
  readonly shapes: BlockShapeRegistry;
  readonly tilesets: TilesetManager;   // atlas textures over document.tilesets
  readonly inspector: VoxelInspector;

  greedy: boolean;                     // assigning rebuilds every chunk
  focus: THREE.Vector3Like | null;
  viewDistance: ViewDistance;
  viewDistancePolicy: "hide" | "unload";
  readonly pendingRebuilds: number;
}
```

The shape registry lives here, not on the document: a block's `shapeId` is
document state, but the shapes it names are code each client registers for
itself, and only the mesher, the collider and block previews read them.

## Methods

```ts
init(): void;                   // builds meshes for voxels already present
tick(deltaTime: number): void;  // rebuilds dirty chunks within the budget
flush(): void;                  // rebuilds every pending chunk now
whenIdle(): Promise<void>;       // see VoxelEngine.md#rebuild-budget
loadTileset(def: TilesetDefinition, texture: TilesetTexture): void;
markAllChunksDirty(source?: string): void;
dispose(): void;                // frees meshes, materials, textures, listeners
```

`loadTileset()` declares the tileset on the document *without* broadcasting a
command, then registers its atlas. An atlas loaded from outside the edit
stream is local to this client; use
[`VoxelDocument.addTileset()`](./VoxelDocument.md) to tell peers about one.

`dispose()` unsubscribes from the document and frees the view's own resources.
It leaves the document alone, since other holders may still be using it.

## What it does with each document signal

| document | view |
| --- | --- |
| `invalidated` | marks every chunk dirty |
| `command`, tileset actions | re-syncs the atlases, then invalidates materials |
| `loaded` | clears the meshes, re-syncs atlases, rebuilds everything |

Atlases are re-synced before the command reaches any other listener, so code
subscribed to the document reads a tileset that already matches it.
