# Pixel draw renderer glossary

A pixel document is a small image, the **texture**, plus a **UV map** that
says which part of the texture covers which face of a 3D mesh. The canvas shows
the texture through a **viewport** and edits it in one **mode** at a time. A
**normal map** can be generated from the texture to light it as if it had
relief.

Each term below describes the idea first. The *In code* line names where it
shows up in the API. Features built on these ideas, such as undo, the color
palette, shortcuts or the clipboard, are described in the [README](./README.md).
[Network](../network/GLOSSARY.md) and [history](../history/GLOSSARY.md) have
their own glossaries.

## Document

### Texture

The image being edited: a rectangle of RGBA pixels. A pixel is addressed by
its position `{ x, y }` in texture space, where y points down. The texture can
be resized or replaced; pixels cut off by a shrink come back when it grows
again.

*In code:* `PixelArtCanvas.texture` and `textureSize`, stored in a
`PixelBuffer`.

### Pixel document

Everything that is saved and shared: the texture, the UV map and the normal map
settings. It needs no canvas, so a server can hold one headless and several
canvases can edit the same one. Every change to it is a *pixel command*,
applied the same way whether it comes from a local edit, a peer, an undo or a
redo. Undo history and what the canvas shows are not part of it.

*In code:* `PixelDocument`. `PixelDocumentState` is the same data without
events, where commands are applied. `PixelCommand`.

## View

### Canvas

The editing surface. It connects one document to input, tools and drawing. Say
*canvas element* for the DOM `<canvas>` it draws into.

*In code:* `PixelArtCanvas`. `canvas()` returns the canvas element.

### Viewport

The window through which the user sees the texture: a camera position and a
zoom level. Panning and zooming change the viewport, never the texture. It
converts between texture space, in texture pixels, and screen space, in pixels
of the canvas element.

*In code:* `PixelArtCanvas.viewport`, with `toScreen()` and `toTexture()`.

### Texture view

What the canvas draws: the texture's own colors (*albedo*) or its normal map
(*normal*). It is view state, never saved or shared. In the normal view the
pixels are read-only, so modes that write pixels are unavailable. A *pixel
lock* makes them read-only in every view.

*In code:* `PixelArtCanvas.textureView`, `"albedo"` or `"normal"`;
`PixelArtCanvas.pixelsLocked`.

## Editing

### Mode

What a click means right now: paint, erase, move, fill, select or uv. One mode
is active at a time. A mode routes input; a *tool* holds the settings behind
it, such as whether a fill is global.

*In code:* `PixelArtCanvas.mode`. Tools are under `canvas.tools`.

### Brush

The paint settings: primary, secondary and erase colors, and a size. A
*stroke* is one paint drag applying a brush color to pixels; it keeps the color
it started with. Erasing is a stroke too, written with the erase color, which
is transparent by default.

*In code:* `PixelArtCanvas.brush`.

### Selection

An area of the texture, rectangular or shaped, that can be moved, transformed,
copied or deleted. A shaped selection can have holes. A *floating selection*
is pasted content that hovers above the texture and is not part of it until it
is dropped.

*In code:* select mode and `canvas.tools.select`.

## UV mapping

### UV map

All the UV regions of a document, plus which region and slot is selected.
Edits keep regions inside the texture, or up to the *overflow*: a number of
texture pixels, or no limit at all, that regions may go past each texture
edge. The overflow is local configuration, like the net.

*In code:* `UVMap`, reached through `canvas.uv`. `UVMap.overflow`, `UVMap.bounds`.

### UV region

A named texture area for one mesh, such as a block. It holds the geometry of
each of the mesh's UV slots: a rectangle, a triangle or a compound shape.

*In code:* `UVRegion`.

### UV slot

A named face of the mesh, such as `front`, `top` or `top.1`. The renderer
treats slot names as open strings; the mesh integration decides which polygons
a slot covers. A region turns slots on or off: only active slots are drawn and
edited, and inactive ones keep their geometry. The API docs also call a slot a
*face*.

*In code:* `UVSlot`. `DEFAULT_UV_SLOTS` holds the six faces of a box.

### UV region state

How a region lays its slots out on the texture:

- *stacked*: every slot shares one rectangle, so all faces show the same
  pixels.
- *unfolded*: the slots sit side by side in a UV net.
- *free*: each slot has its own rectangle anywhere on the texture.

The state decides what a drag or a rotation acts on: the whole region when
stacked or unfolded, one slot when free.

*In code:* `UVRegion.state` and `UVMap.setState()`.

### UV net

The arrangement of an unfolded region's slots. By default they are packed into
the smallest box; a grid net gives each slot a fixed cell instead. The net is
local configuration: only the resulting region is saved and shared.

*In code:* `UVNet`, set through `canvas.uv.net`.

### UV ownership

Which document stores a UV region. By default the pixel document stores all of
them. A host can hand some to another document, such as a 3D model: the pixel
document still shows and edits those regions, but leaves them out of its own
commands and snapshots.

*In code:* `PixelDocument.disownUvRegions()` and `ownsUvRegion()`.

## Normal maps

### Normal map

Per-pixel surface directions generated from the texture, used to light it as
if it had relief. Red points right and green points up in the image. The
document stores only the *settings*; the normal pixels are generated on
request, so they never go stale. A *zone* overrides the settings for one UV
region, or turns the normal map off there.

*In code:* `NormalMap`, and `NormalMapConfig` for settings and zones.

### Island

An area of the texture that normal generation never samples across. In an
atlas, the pixel across a face edge belongs to another face, so islands follow
the UV slots, or faces a host supplies instead. Faces that overlap form one
island, faces that only touch stay apart, and pixels outside every face form
one remainder island.

*In code:* `IslandMap`.
