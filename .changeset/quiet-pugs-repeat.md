---
"@jolly-pixel/voxel.renderer": major
---

Rename the block and tile types after their intent: `BlockDefinition` is now the
authoring form (formerly `BlockDefinitionIn`) and `ResolvedBlockDefinition` what
`BlockRegistry` stores; likewise `TileRef` is the authoring union and
`ResolvedTileRef` the object form. `BlockRegistry.register()` no longer mutates
the definition it is given.
