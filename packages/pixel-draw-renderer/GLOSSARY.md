# Pixel draw renderer glossary

This glossary defines the vocabulary for the local pixel-drawing context. It covers editing, selection, UV mapping, rendering, and undo/redo. Network synchronization has its own bounded context and is intentionally out of scope.

## Terms

### Pixel Document

The editable unit of work: the texture data, UV map, and local undo/redo history. `PixelDocument` is the internal owner of these parts.

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

The active input interpretation: `paint`, `move`, `fill`, `select`, or `uv`.

### Tool

A component that performs or configures an editing behavior. Brush, fill, selection, line, and UV manipulation are tools.

### Brush

The paint configuration: primary and secondary colors, opacity, size, and cursor appearance.

### Stroke

One completed paint or line operation that applies a brush color to a set of pixel positions.

### Selection

A completed rectangular or shape-masked region of the texture that can be moved, transformed, copied, or deleted. A shape selection can have holes inside its rectangular bounds.

### Floating Selection

Pasted content held above the texture until it is deposited. It can be moved, but is not yet stored in the pixel buffer.

### UV Region

A named texture area mapped to one or more mesh faces. A region may use one shared rectangle or separate geometry for individual faces.

### UV Map

The collection of UV regions and its current region and face selection.

### History Entry

The reversible record of one local edit, used by undo and redo.

## Naming boundaries

- Use **texture** for editable image data, **viewport** for the user's view of it, and **canvas element** for a DOM canvas.
- Use **brush** for paint configuration and **stroke** for a completed painting operation.
- Use **selection** for a region already in the texture and **floating selection** for pending pasted content.
- Use **UV region** for one mapping and **UV map** for the collection that manages all mappings.
- Use **mode** for input routing and **tool** for editing behavior.
