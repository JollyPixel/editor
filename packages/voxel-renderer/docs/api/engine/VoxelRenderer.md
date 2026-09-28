# VoxelRenderer

`VoxelRenderer` runs a [`VoxelView`](../core/VoxelView.md) through the
JollyPixel actor-component lifecycle. It attaches the view root and
initializes it during `awake()`, ticks the view during `update()`, and removes
and disposes it during `destroy()`. This entry point requires the optional peer
`@jolly-pixel/engine`.

```ts
import { VoxelRenderer } from "@jolly-pixel/voxel.renderer/engine";

const renderer = actor.addComponentAndGet(VoxelRenderer, {
  focus: cameraActor.object3D,
  tilesets,
  document: {
    blocks,
    layers: ["Ground"]
  }
});

renderer.document.world.setVoxel("Ground", {
  position: { x: 0, y: 0, z: 0 },
  blockId: 1
});
```

## API

```ts
interface VoxelRendererOptions extends VoxelViewOptions {
  /** A document to draw, or the options of one the renderer builds. */
  document?: VoxelDocument | VoxelDocumentOptions;
  focus?: THREE.Object3D | null;
}

class VoxelRenderer extends ActorComponent {
  readonly document: VoxelDocument;
  readonly view: VoxelView;
  focus: THREE.Object3D | null;

  constructor(actor: Actor<any>, options?: VoxelRendererOptions);
  awake(): void;
  update(deltaTime: number): void;
  destroy(): void;
}
```

A document passed as an instance belongs to its owner: `destroy()` disposes the
view only. A document built from options, or from nothing, belongs to the
renderer and is disposed with it. Pass an instance to draw a document that
outlives the actor, such as one synchronized over the network.

The actor world's logger is used unless `options.logger` is supplied; it is
handed to the document the renderer builds and to the view. When a focus
object is set, its world position is converted to view-root local coordinates
on every update before the view ticks.
