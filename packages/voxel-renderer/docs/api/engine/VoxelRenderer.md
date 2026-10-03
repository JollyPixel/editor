# VoxelRenderer

A JollyPixel actor component that runs a [`VoxelView`](../core/VoxelView.md):
it attaches and initializes the view on `awake()`, ticks it on `update()` and
disposes it on `destroy()`. Requires the optional peer `@jolly-pixel/engine`.

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

renderer.document.world.setVoxel("Ground", { position: { x: 0, y: 0, z: 0 }, blockId: 1 });
```

## Options

Every [`VoxelViewOptions`](../core/VoxelView.md#options) field, plus:

| Option | Type | Description |
| --- | --- | --- |
| `document` | `VoxelDocument \| VoxelDocumentOptions` | The document to draw, or options for one the renderer creates. |
| `focus` | `THREE.Object3D \| null` | Object whose world position becomes `view.focus` on every update. `null` leaves `view.focus` as it is. |

`logger` defaults to the actor world's logger.

## Properties

```ts
readonly document: VoxelDocument;
readonly view: VoxelView;
focus: THREE.Object3D | null;
```

## Ownership

A document passed as an instance stays with its owner: `destroy()` disposes
only the view. A document created from options is disposed with the
component. Pass an instance for a document that outlives the actor, such as a
synchronized one.

## Frame requests

The view's [frame requests](../core/VoxelView.md#frame-requests) call
`world.invalidate()` and then `options.requestFrame` when given. The component
keeps the world rendering while `view.pendingRebuilds` is above zero, so an
on-demand runtime needs no extra wiring.
