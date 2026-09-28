---
"@jolly-pixel/voxel.renderer": major
---

Remove greedy meshing (`greedy`, `enableTileWrapping()`, the `mergedFaces` metric) and `retainVertexData`: every chunk is now vertex pulled.
View options are grouped into `rendering`, `lighting`, `range` and `meshing`, with `view.rendering`, `view.lighting` and `view.range` (also on `VoxelEngine`) replacing the flat accessors; `rebuildBudgetMs` and `meshWorkers` become `meshing.budgetMs` and `meshing.workers`.
