# API name migration

The renderer replaces ambiguous factories, lookups, conversions, and updates
with names that describe their operation. Update imports and calls below. These are
breaking API renames; the argument types and runtime behavior are unchanged.
Serialized block ids, transforms, worlds, and templates remain compatible.

| Previous name | Replacement |
|---|---|
| `BlockTextures.of` | `BlockTextures.fromBlock` |
| `BlockTextureLayout.of` | `BlockTextureLayout.fromShape` |
| `ShapeOccupancy.of` | `ShapeOccupancy.fromShape` |
| `VoxelFootprint.of` | `VoxelFootprint.fromObject` |
| `BlockRegistry.indexOf` | `BlockRegistry.findIndex` |
| `BlockRegistry.propertiesOf` | `BlockRegistry.copyProperties` |
| `BlockComplements.occupancyOf` | `BlockComplements.resolveOccupancy` |
| `VoxelLayer.positionsOf` | `VoxelLayer.positionsUsingBlocks` |
| `VoxelBlockInspector.usageOf` | `VoxelBlockInspector.inspectUsage` |
| `VoxelBlockInspector.blocksetUsageOf` | `VoxelBlockInspector.inspectBlocksetUsage` |
| `BlockPieces.pieceOf` | `BlockPieces.resolvePiece` |
| `BlockPieces.geometryOf` | `BlockPieces.buildGeometry` |
| `BlockPieces.textureOf` | `BlockPieces.resolveTexture` |
| `BlockPieces.emptySlotsOf` | `BlockPieces.findEmptySlots` |
| `blocksetSlotOf` | `decodeBlocksetSlot` |
| `localBlockIdOf` | `decodeLocalBlockId` |
| `voxelCellOf` | `floorVoxelPosition` |
| `voxelPositionOf` | `resolveSurfaceCell` |
| `tileRectOf` | `resolveTileRect` |
| `slotNameOf` | `faceSlotName` |
| `slotKeyOf` | `normalizeSlotKey` |
| `baseSlotOf` | `baseSlotName` |
| `occlusionMaskOf` | `computeOcclusionMask` |
| `sideCoverageOf` | `computeSideCoverage` |
| `BlockTextures.forSlot` | `BlockTextures.resolveSlotTexture` |
| `BlockTextures.spanFor` | `BlockTextures.resolveSlotSpan` |
| `BlockTextures.withSize` | `BlockTextures.withTileSize` |
| `BlockTextures.staysOnGrid` | `BlockTextures.canRescaleOnGrid` |
| `BlockTextures.withBlockset` | `BlockTextures.withDefaultBlockset` |
| `BlockTextures.applyTo` | `BlockTextures.createTexturedBlock` |
| `VoxelTemplate.placedPositionFor` | `VoxelTemplate.placementPositionFromMinCorner` |
| `BlocksetList.bySlot` | `BlocksetList.findBySlot` |
| `BlocksetList.freeSlot` | `BlocksetList.findAvailableSlot` |
| `BlocksetList.apply` | `BlocksetList.applyCommand` |
| `MaterialGroup.applyTo` | `MaterialGroup.applyMaterialFinish` |
| `BlockRegistry.moveTo` | `BlockRegistry.moveBlockToIndex` |
| `BlockRegistry.apply` | `BlockRegistry.applyCommand` |
| `MaterialGroupList.apply` | `MaterialGroupList.applyCommand` |
| `BlendGroupList.apply` | `BlendGroupList.applyCommand` |
| `BlockTextureLayout.slotsIn` | `BlockTextureLayout.slotsUsingBlockset` |
| `BlockTextureLayout.drawnRectsIn` | `BlockTextureLayout.collectDrawnTileRects` |
| `BlockTextureLayout.footprintsIn` | `BlockTextureLayout.collectTileFootprintRects` |
| `BlocksetSlot.owns` | `BlocksetSlot.ownsBlockId` |
| `BlocksetSlot.blockId` | `BlocksetSlot.composeBlockId` |
| `BlocksetSlot.localBlockId` | `BlocksetSlot.decodeLocalBlockId` |
| `BlocksetSlot.groupId` | `BlocksetSlot.qualifyGroupId` |
| `BlocksetSlot.localGroupId` | `BlocksetSlot.decodeLocalGroupId` |
| `BlocksetSlot.project` | `BlocksetSlot.projectBlock` |
| `BlocksetSlot.projectAll` | `BlocksetSlot.projectBlocks` |
| `BlocksetSlot.local` | `BlocksetSlot.localizeBlock` |
| `BlocksetSlot.localMaterialGroup` | `BlocksetSlot.localizeMaterialGroup` |
| `BlocksetAtlas.uvFor` | `BlocksetAtlas.computeTileUvRegion` |
| `BlocksetAtlas.disposeReplacedBy` | `BlocksetAtlas.disposeUnsharedTextures` |
| `BlocksetAtlases.resolve` | `BlocksetAtlases.resolveAtlas` |
| `BlocksetAtlases.atlas` | `BlocksetAtlases.requireLoadedAtlas` |
| `VoxelView.canMergeAt` | `VoxelView.canMergeVoxelPart` |
| `VoxelView.partAt` | `VoxelView.pickVoxelPart` |
| `BlockDocument.apply` | `BlockDocument.applyCommand` |
| `VoxelDocument.apply` | `VoxelDocument.applyCommand` |
| `VoxelWorld.apply` | `VoxelWorld.applyCommand` |
| `VoxelTemplates.apply` | `VoxelTemplates.applyCommand` |
| `VoxelObjectLayers.apply` | `VoxelObjectLayers.applyCommand` |
| `BlockDocument.fold` (protected) | `BlockDocument.applyCommandToState` |

`BlocksetDocument` also inherits `applyCommand()`. Subclasses of
`BlockDocument` must rename their protected `fold()` override to
`applyCommandToState()`; it applies the command without emitting an event.

For example, a transformed block preview now uses
`pieces.resolvePiece(block, transform)`. It still returns a cached piece
whose geometry belongs to the cache. Use `pieces.buildGeometry(block,
transform)` when the caller needs to own and dispose the geometry.

`BlockTextures.createTexturedBlock(block)` returns a block with the textures;
when they are unchanged it returns the original block.
`MaterialGroup.applyMaterialFinish(material)` updates the supplied Three.js
material in place. `BlocksetAtlases.requireLoadedAtlas(id)` throws if the
atlas is unavailable; `resolveAtlas(id)` supplies the missing-texture atlas
for an undeclared id, and returns `undefined` for a declared but unloaded atlas.
