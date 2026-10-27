# Voxel renderer glossary

A voxel world is a stack of layers filled with blocks. The document holds what
is placed and keeps peers in agreement about it; the view turns it into
meshes, one chunk at a time, and leaves out every face nobody can see.

## Document and view

### Document

Everything a peer synchronizes about a world: its layers, block registry,
blocksets and undo history. `VoxelDocument` emits the command stream and draws
nothing.

### View

The Three.js side of a document: chunk meshes, materials, atlas textures,
shapes, collider and inspector. `VoxelView` follows a document and keeps its
meshes in step. Several views can draw the same document.

## World

### Voxel

One occupied cell of a layer. It records a block ID and a transform; its layer
and position decide where it appears. An empty cell is **air**, the reserved
block ID `0`, and is never stored.

A **merged cell** holds two shapes that fill it together, such as a
`slabBottom` and a `slabTop`. Each keeps its own block and transform, the
second being the cell's partner, and the cell still counts as one voxel.

### Layer

A named, ordered collection in the world. A **voxel layer** holds voxels; an
**object layer** holds placed objects such as spawn points and trigger zones,
and never produces meshes. Layers are either visible or hidden.

A voxel layer has a position, the world-space offset of its origin, so moving
it does not rewrite its voxels. Its place in the stack is a **rank**, a
fractional-index string: a higher rank sits above, ties sort by layer ID, and
a move only writes the moved layer's rank, so moves of different layers
commute.

### Compositing

How overlapping voxel layers combine. Reads at a world position return the
voxel of the highest visible layer. When drawing, a higher voxel hides a lower
one in the same cell only if its block fills the cell with opaque geometry, or
if the higher layer uses `"replace"` compositing.

### Chunk

A fixed-size cube of cells inside a voxel layer, and the unit the view meshes
and shows. An edit marks its chunk **dirty**, along with the neighbor when the
edit touches a chunk boundary, until its mesh is rebuilt.

### Template

A named group of voxels saved with the world and never drawn. Placing a
template copies its voxels into a layer around its pivot, optionally turned or
mirrored. The copies keep no link to the template, which is why it is not
called a prefab.

## Blocks

### Block

The reusable definition a voxel points to through its block ID. It names the
block and picks its shape, face tiles, collision and transparency. A
**transparent** block has textures with holes or translucency, such as leaves
or glass, and does not hide its neighbors' faces.

### Shape

Geometry shared by any number of blocks: a list of faces, and the sides that
fully cover a neighbor's face. Cube, slab, ramp, pole and stair are built in;
custom shapes can be registered.

### Transform

The orientation of one placed voxel: quarter-turn rotations and axis flips.
It changes how the shape sits without changing the block. A **tile rotation**
is different: it turns only the image inside one face and belongs to the
block's tile reference.

### Blockset

A set of blocks together with the image their faces sample, cut into a grid of
square **tiles** addressed by column and row. A block picks a default tile and
can override it per face. A blockset has a stable ID, and a slot that
namespaces its block IDs inside a world. It is not a 2D tileset; its tiles
only texture block faces.

The **atlas** is the texture the view loads from a blockset, with the same
grid. An optional **normal atlas** shares that layout and stores a surface
direction per texel, giving flat faces relief under lighting. The renderer
only reads it; the host paints or generates it.

## Rendering

### Meshing

Turning the voxels of a chunk into the surfaces the view draws. It applies
compositing, voxel transforms and culling. A dirty chunk's mesh is replaced
without touching the stored voxels.

### Culling

Not drawing what cannot be seen. It never changes the world.

- **Face culling** leaves a face out of the mesh when a neighbor's shape fully
  covers it. A cube covers all six sides; a partial shape only the sides it
  fills. Faces shared by two voxels of the same transparent block are kept
  unless the block sets `cullCoveredFaces: true`.
- **Chunk culling** hides whole chunks outside the **view distance**, the
  chunk radius kept active around the view's focus. Depending on their state
  and the configured policy, those chunks stay unmeshed, hidden or unloaded.
