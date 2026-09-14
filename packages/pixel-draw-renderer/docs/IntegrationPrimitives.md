# Integration primitives

The package root exports the renderer-owned operations used by persistence and
collaboration adapters. `@jolly-pixel/asset.pixel-art` uses these APIs without
importing renderer source files.

## Buffer command helpers

`groupPositionsByColor()` converts parallel position and RGBA arrays into
`ColorGroup` records. `applyColorGroups()` writes those records to a
`PixelBuffer`. `Fill.matchAll()` returns every position matching an RGBA color;
adapters use it to replay global-fill commands with the renderer's fill rules.

## UV validation and conflict keys

The root exports `isUVGeometry()`, `isUVRegionData()`, `isUVSlot()`, and
`isUVTextureRect()` for validating serialized UV command data.
`uvTargetKey()` converts a `UVTarget` into the stable key used by conflict
trackers.

## Pixel positions

`isVec2()` validates an `{ x, y }` value. `vec2Equal()` compares two positions
or two `null` values.

## Presence state types

`PeerSelectionOutlineState`, `PeerFloatingSelectionState`, and
`PeerUVPreviewState` describe the values written through `PixelArtCanvas` peer
presence overlays. They are type-only exports.
