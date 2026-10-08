# Pixel draw renderer glossary

This glossary defines the vocabulary for the local pixel-drawing context. It covers editing, selection, UV mapping, rendering, and undo/redo. Network synchronization has its own bounded context and is intentionally out of scope.

## Terms

### Pixel Document

The editable unit of work: the texture data, UV map and normal map settings. `PixelDocument` owns these parts and needs no view: a network client can sync it headless, and several canvases can edit one document. Undo and redo live in a *history* the canvas or its host owns, which records the document's changes.

### Texture

The rectangular RGBA image being edited. A texture has a size and can be loaded, replaced, resized, or exported.

### Pixel

One addressable RGBA cell in texture coordinates. Use *pixel position* for its `{ x, y }` coordinate.

### Pixel Buffer

Headless storage for the texture's pixels. It has a working buffer and retained master data so content can survive resize cycles.

### Pixel-art Canvas

`PixelArtCanvas`, the public editing surface that connects the document, input, tools, and rendering. Use *canvas element* when referring to an `HTMLCanvasElement`.

### Viewport

The camera and zoom through which the user sees and navigates the texture. Panning changes the viewport; it does not move the texture.

### Mode

The active input interpretation: `paint`, `erase`, `move`, `fill`, `select`, or `uv`.

### Shortcut

A keyboard-driven intent of the canvas, such as undo, delete, or rotate, reached through `canvas.shortcuts`. The renderer owns what a shortcut does in each mode; the host owns which key triggers it. *Held modifiers* are the pan and line states a host sets while a key stays down.

### Tool

A component that performs or configures an editing behavior. Brush, fill, selection, line, and UV manipulation are tools.

### Color Palette

The ten saved RGBA8 colors of a Pixel Document, addressed by fixed slot
indices from zero to nine. A palette slot change is a Pixel Command and a
History Step when history is enabled. Palette selection and color picker
drafts are local view state. Changing a slot leaves texture pixels unchanged.

### Brush

The paint configuration: primary and secondary colors, opacity, size, and cursor appearance.

### Eraser

The brush writing its erase color, transparent by default. Erasing is a stroke like any other: it is undoable, synchronized, and shares the brush size. Distinct from the *selection erase color*, which fills the pixels a selection vacates.

### Stroke

One completed paint or line operation that applies a brush color to a set of pixel positions. The color is read once, when the stroke starts.

### Line Anchor

The saved pixel position from the last paint or erase mouse-down. A straight line starts here when the line modifier is held. Before any click, the first available cursor position while the modifier is held supplies the anchor. Hover, mouse-up, and preview cancellation keep it; replacing or resizing the texture clears it.

### Selection

A completed rectangular or shape-masked region of the texture that can be moved, transformed, copied, or deleted. A shape selection can have holes inside its rectangular bounds.

### Floating Selection

Pasted content held above the texture until it is deposited. It can be moved, but is not yet stored in the pixel buffer.

### Selection Presence

An immutable description of the current selection for another view. It includes
creating and resizing bounds, a completed selection's bounds and mask, or a
moving or floating selection's exact pixels, mask and preview erase color.
`SelectionPresence` owns and validates this data; its snapshots are independent
copies. Room membership and network retention belong to the network context.

### UV Region


A named texture area mapped to one or more mesh texture slots. A region may use one shared rectangle or separate geometry for individual slots.

### UV Slot

A consumer-defined texture mapping identifier such as `front`, `top`, or `top.1`. The renderer core treats slots as open strings; a mesh integration decides which polygons each slot controls. A region may carry geometry for inactive slots; only active slots are drawn, selected, moved, rotated or resized.

### UV Map

The collection of UV regions and its current region and slot selection.

### UV Target

The part of a UV map addressed by an interaction or change. A target identifies a region and may identify one slot within it.

### UV Clip

The pixel area a fill may touch when `FillTool.uvClip` is on. Seeded inside one or more UV slots, it is the union of those slots; seeded outside, it is every pixel outside all slots. Membership uses pixel centers, active slots, and every region regardless of view visibility. `clearTexture()` keeps the same slot pixels by default.

### UV Ownership

Which document stores a UV region. By default the pixel document stores every region, and UV edits become commands and history steps. An external region is stored by another document, such as a model; the pixel document only shows and edits it, and ignores that region in its own commands and snapshots.

### UV Layout

A UV region's geometry without its identity (`id`, `name`, `color`). The owner of an external region stores its layout, and the region is rebuilt from that layout and an identity when shown.

### UV Movement Scope

Whether a drag moves a whole UV region or one slot. Stacked and unfolded regions have region scope; free regions have slot scope.

### Nested UV

What a drag moves, following the UV movement scope (a whole region, or one slot of a free region), when its rectangle lies inside another one's, edges included. A move drag with the line modifier held carries the nested UVs of the dragged unit by the same delta, and the drop is one history step. A unit that only overlaps is not nested.

### UV Rotation

The quarter turns a UV slot's mapping has taken, clockwise in texture space. It follows the UV movement scope: stacked and unfolded regions turn whole, a free region turns one slot. The slot geometry is stored as it looks after the turn, and the rotation tells a mesh which way its UVs face inside it.

### UV Resize

Changing a UV rectangle's size independently of the mesh. A stacked region resizes whole and resets every face to the new size. An unfolded or free region resizes one slot; in an unfolded net, faces act as solid boxes: a growing face pushes the faces it runs into, a shrinking one pulls back the faces that touched it, and faces out of contact stay put. Regions with a triangle or compound face cannot be resized.

### Normal Map

Per-pixel surface directions derived from the texture, its islands and the document's normal map settings. The document stores only the settings; the normal pixels are generated when a consumer asks for them, so they never go stale against the texture. Normals point right (red) and up in the image (green).

### Island

An area of the texture that normal map generation never samples across. Islands follow the UV slot faces, or the faces a host supplies in their place: faces whose pixels overlap form one island, faces that only touch stay separate, and pixels covered by no face form one remainder island.

### Normal Map Zone

An override of the normal map settings for one UV region, addressed by region id with no geometry of its own. A zone can turn the normal map off for the islands the region touches. A zone whose region is missing is kept and ignored.

### Texture View

What the canvas draws for the texture: its pixels (*albedo*) or its generated normal map (*normal*). It is view state, never stored or synchronized. The normal view is read-only for pixels: modes that write pixels are unavailable and a selection cannot move, delete or transform pixels.

### Pixel Command

One change to a pixel document: a stroke, a texture resize or replacement, a UV region change, or a normal map settings change. Local edits, undo and redo emit commands, and peers apply them. *Document state* is the texture, UV map and normal map settings without history or view; it applies every command, remote, undone or redone, the same way.

### Edit Change

What the document emits for each applied command: the command, its origin (*local*, *remote* or *replay*), and for a local edit the commands that undo it. Undo history is built from edit changes outside the renderer. An *edit source* emits edit changes and applies the commands of an undo or redo: the document, and the canvas's selection.

### History Step

The reversible record of one local edit, used by undo and redo: the commands that undo it, and the values they must find unchanged. The host's history decides when a peer edit refuses a step; the canvas only binds to that history.

## Naming boundaries

- Use **texture** for editable image data, **viewport** for the user's view of it, and **canvas element** for a DOM canvas.
- Use **brush** for paint configuration and **stroke** for a completed painting operation.
- Use **eraser** for the brush writing its erase color, never for selection deletion.
- Use **selection** for a region already in the texture and **floating selection** for pending pasted content.
- Use **UV region** for one mapping and **UV map** for the collection that manages all mappings.
- Use **mode** for input routing and **tool** for editing behavior.
- Use **normal map** for the generated directions and **normal map settings** for what the document stores; use **island** for a generation area, never *tile* or *chunk*.
