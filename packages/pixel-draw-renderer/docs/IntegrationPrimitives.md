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

The root exports `isUVGeometry()`, `isUVRegionData()`, `isUVLayoutData()`,
`isUVSlot()`, and `isUVTextureRect()` for validating serialized UV command
data. `isUVLayoutData()` checks a region without its identity, as
`UVRegion.toLayout()` writes it.
`uvTargetKey()` converts a `UVTarget` into the stable key used by conflict
trackers.

## Pixel positions

`isVec2()` validates an `{ x, y }` value. `vec2Equal()` compares two positions
or two `null` values.

## Presence state types

`PeerSelectionOutlineState`, `PeerFloatingSelectionState`,
`PeerUVPreviewState`, and `PeerUVSelectionState` describe the values written
through `PixelArtCanvas` peer presence overlays. They are type-only exports. A
`PeerUVPreviewState` holds the peer's dragged `region`, the `face` it changes or
`null` for the whole region, and the peer `color`.

A `PeerUVSelectionState` holds the `regionId` a peer has selected and the peer
`color`, written with `canvas.peerPresence.uvSelections.set(clientId, state)`.
That region's border takes the peer color and paints above plain borders but
below the local selection. The local selection always keeps its own highlight,
and the first peer set wins when several peers select one region.
