# Voxel renderer architecture

Two layers. The document never imports the view; a lint rule enforces it.

- `src/document`: `VoxelDocument`, the headless state and its commands.
- `src/view`: `VoxelView`, the Three.js meshes that draw a document.
- `src/plugins`: the `engine` actor component and the `rapier` collider.

## Map

```mermaid
flowchart TB
    Renderer["VoxelRenderer<br/>engine actor"] --> Document["VoxelDocument"]
    Renderer --> View["VoxelView"]
    View -. "observes" .-> Document
    Document --> World["VoxelWorld"]
    Document --> Blocks["blocks, blocksets, materials"]
    View --> Pipeline["ChunkPipeline"]
    Pipeline --> Root["view.root<br/>THREE.Group"]
```

Without the engine, add `view.root` to a scene and call `init()`, `tick()` and
`dispose()` yourself.

## World

```mermaid
flowchart TB
    World["VoxelWorld"] --> Layers["VoxelLayer"]
    World --> Objects["object layers"]
    World --> Templates["templates"]
    Layers --> Chunks["chunks<br/>packed voxels"]
```

- A voxel is a block ID plus a transform.
- A merged cell holds two shapes, such as a bottom and a top slab.

Code: `src/document/world`.

## Edits

```mermaid
flowchart TB
    Local["world.setVoxel()"] --> Apply["the owning aggregate applies it"]
    Remote["document.applyCommand()"] --> Apply
    Apply --> Dirty["dirty chunks"]
    Apply --> Event["'command' event"]
```

- `VoxelWorld`, `BlockRegistry`, `MaterialGroupList` and `BlocksetList` each apply their own commands.
- The event carries the origin: `"local"` for an edit, the caller's for `applyCommand()`.

Code: `src/document/commands`.

## Dirty chunk to mesh

```mermaid
flowchart TB
    Tick["view.tick()"] --> Pipeline["ChunkPipeline<br/>visibility, rebuild queue"]
    Pipeline --> Builder["VoxelMeshBuilder<br/>or mesh workers"]
    Builder --> Store["ChunkMeshStore"]
    Store --> Root["view.root"]
    Store --> Collider["collider, optional"]
```

- An edit dirties its chunk and the neighbours whose faces it can expose or cover.
- Rebuilds run within a budget per tick; `flush()` drains the queue at once.

Code: `src/view/chunks`, `src/view/meshing`, `src/view/workers`.

## Save and load

```mermaid
flowchart TB
    Document["VoxelDocument"] -->|"save()"| Snapshot["VoxelWorldJSON"]
    Snapshot -->|"load()"| Document
    Document -->|"loaded"| View["VoxelView<br/>clear, sync atlases, rebuild"]
```

- Each layer is saved as a palette plus run-length encoded chunks.

Code: `src/document/serialization`.

Details: [`VoxelDocument`](./docs/api/core/VoxelDocument.md),
[`VoxelView`](./docs/api/core/VoxelView.md),
[`VoxelRenderer`](./docs/api/engine/VoxelRenderer.md),
[serialization](./docs/api/serialization/serialization.md),
[physics integration](./docs/guides/adding-physics.md).
