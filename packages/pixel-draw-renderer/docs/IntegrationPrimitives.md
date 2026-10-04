# Integration primitives

The package root exports the renderer-owned operations used by persistence and
collaboration adapters. `@jolly-pixel/asset.pixel-art` uses these APIs without
importing renderer source files.

## Commands

[`PixelDocumentState`](./PixelDocumentState.md) applies [`PixelCommand`](./PixelCommand.md)s
without a DOM, with the same code a `PixelDocument` runs for remote commands,
undo and redo. `toDocumentCommand()` decodes a command's texture bytes before
it is applied. `PixelBuffer.positionsOf()` returns the positions a
`global-fill` repaints, for adapters that compute its conflict keys.
`groupPositionsByColor()` converts parallel position and RGBA arrays into
`ColorGroup` records for `drawColorGroups()`.

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

## Selection presence

`SelectionPresence` is the immutable selection snapshot value object.
`new SelectionPresence(data)` validates and copies `SelectionPresenceData`,
throwing `RangeError` for invalid geometry, masks, pixel content or erase color.
`SelectionPresence.parse(unknown)` returns a valid value object or `null`.
`toJSON()` returns independent copies of all rectangles, masks, pixels and
colors, preserving RGBA bytes including RGB under zero alpha.

Its data uses these phases:

| Phase | Data |
| --- | --- |
| `creating`, `resizing` | `rect` |
| `selected` | `rect`, row-major `mask` |
| `moving`, `floating` | `sourceRect`, `liveRect`, row-major `pixels` and `mask`, `eraseColor`, `blankSource` |

Coordinates are safe integers in texture pixels; widths and heights are
positive. Masks select at least one cell and match the rectangle area. Preview
source and live rectangles have equal dimensions, and every pixel and erase
color channel is an integer from 0 to 255. Negative positions and positions
outside the texture are allowed; rendering clips to the texture. A floating
paste never blanks its source. `SelectionPresence.capture(state, eraseColor?)`
projects the renderer's selection interaction state; preview states require an
erase color. Consumers normally read `canvas.selectionPresence` and subscribe
to `selection-presence-changed` instead.

## Presence state types

`PeerSelectionOutlineState`, `PeerFloatingSelectionState`,
`PeerUVPreviewState`, and `PeerUVSelectionState` describe the values written
through `PixelArtCanvas` peer presence overlays. They are type-only exports. A
`PeerUVPreviewState` holds the peer's dragged `region`, the `face` it changes or
`null` for the whole region, and the peer `color`. The UV overlay draws it as a dashed border in place of that region's own border, above the stored borders.

A `PeerUVSelectionState` holds the `regionId` a peer has selected and the peer
`color`, written with `canvas.peerPresence.uvSelections.set(clientId, state)`.
That region's border takes the peer color and paints above plain borders but
below the local selection. The local selection always keeps its own highlight,
and the first peer set wins when several peers select one region.

`PeerFloatingSelectionState` accepts optional row-major `pixels` and
`eraseColor`. When supplied, previews use those bytes and that color. Omitting
them preserves source sampling and erase color resolution from the receiving
buffer. Replacing pixels or erase color rebuilds an existing preview even if
the source rectangle and mask stay the same.
