# Voxel renderer glossary

This glossary defines the vocabulary for voxel worlds, blocks, layers,
appearance, and meshing.

## World structure

### Voxel

One occupied unit cell in a voxel layer. A voxel records a block ID and a
transform; its layer and world position determine where it appears.

### Air

An empty voxel cell. Air uses the reserved block ID `0` and is never stored in
the world.

### World

The complete layered voxel scene. `VoxelWorld` owns voxel layers and object
layers, resolves reads at world positions, and coordinates changes that affect
more than one layer.

### Document

Everything a peer synchronizes about a world: its voxel layers, block registry,
tileset declarations and undo history. `VoxelDocument` owns them and emits the
command stream, and draws nothing.

### View

The Three.js side of a document: the chunk meshes, their materials, the atlas
textures, the shape registry, the collider and the inspector. `VoxelView`
subscribes to a document and keeps the meshes in step with it. Several views
can draw one document.

### Chunk

A fixed-size cubic region within a voxel layer. Chunks are the unit used to
rebuild and display parts of the world after voxel changes.

### Dirty Chunk

A chunk whose generated mesh may no longer match the world. Voxel edits,
layer changes, and edits along a chunk boundary can mark chunks dirty.

## Layers

### Voxel Layer

A named, ordered collection of voxels. A voxel layer has its own visibility
and world-space position, and divides its voxel data into chunks.

### Layer Rank

A fractional-index string that places a voxel layer in the stack; a higher
rank sits above a lower one, and ties sort by layer id. A move writes only
the moved layer's rank, so moves of different layers commute. Voxel layer
commands name their layer by id, never by name or index.

### Object Layer

A named, ordered collection of placed objects such as spawn points and trigger
zones. Object layers are saved with the world and do not produce voxel meshes.

### Layer Compositing

The rules for overlapping voxel layers. World reads use the voxel from the
highest-priority visible layer. During rendering, a higher layer hides a lower
voxel in the same cell only when its block fills the cell with opaque geometry,
or when the higher layer uses `"replace"` compositing.

### Voxel Template

A named group of voxels saved with the world and never drawn. Placing a
template copies its voxels into a voxel layer around its pivot, optionally
turned or mirrored; the placed voxels keep no link to the template.

### Layer Position

The world-space location of a layer's local origin, applied to every voxel in
the layer. Changing the position moves the layer without rewriting its stored
voxel positions.

## Blocks and appearance

### Block Definition

The reusable description referenced by a voxel's block ID. It gives the block
a name and selects its shape, face textures, collision behavior, and
transparency behavior.

### Block Shape

The geometry shared by one or more block definitions. A shape describes its
faces and which sides fully cover a neighboring voxel face. Cube, slab, ramp,
pole, and stair are built-in shapes.

### Voxel Transform

The orientation of one placed voxel. Quarter-turn rotation and axis flips
change how its block shape appears while keeping the same block definition.

### Face

One surface of a block shape. A face has an orientation and texture mapping,
and may take part in occlusion.

### Transparent Block

A block whose texture may contain visible holes, such as leaves or a grate. It
does not hide a neighboring block face. Faces shared by two voxels of the same
transparent block are kept unless the block sets `cullCoveredFaces: true`.

### Tileset

An image arranged as a grid of square tiles for block faces. A tileset has a
stable ID so block definitions can refer to its tiles.

### Tile

One square image in a tileset, addressed by its column and row. A block
definition can choose a default tile and override it for individual faces.

### Tile Rotation

Clockwise quarter turns of a tile image inside the face it textures. It belongs
to the tile reference, so it is distinct from a voxel transform, which turns
the whole placed voxel.

### Atlas

The loaded texture prepared from a tileset for rendering. The atlas keeps the
same tile grid as its tileset.

### Normal Atlas

An optional second texture of an atlas, with the same layout, holding one
surface direction per texel. Lighting reads it to give flat faces relief. The
renderer only consumes it; the host paints or generates it.

## Meshing and visibility

### Mesh

The renderable surfaces generated from the voxels in a chunk. A mesh can be
replaced when its chunk becomes dirty without changing the stored voxels.

### Meshing

The process that turns placed voxels into the surfaces the renderer draws. It
applies layer compositing, block transforms, and face culling while building a
chunk mesh.

### Occlusion

Complete coverage of a voxel face by a neighboring shape. A cube can occlude
all six directions, while a partial shape occludes only the sides it fully
covers.

### Face Culling

Leaving an occluded face out of a generated mesh. Face culling reduces the
amount of geometry while leaving both voxels in the world.

### View Distance

The chunk radius around the view's focus that is kept active for rendering.
Chunks outside the radius remain unmeshed, are hidden, or are unloaded according
to their current state and the configured policy.

### Chunk Culling

Hiding a whole rendered chunk because it lies outside the view distance. Chunk
culling does not change the world or the voxels stored in that chunk.

## Naming boundaries

- Use **voxel** for a placed value and **block definition** for the reusable
  description it references.
- Use **air** for an empty cell, not for a block definition with ID `0`.
- Use **world**, **voxel layer**, and **chunk** for the three levels of voxel
  organization.
- Use **voxel layer** for block cells and **object layer** for placed objects.
- Use **voxel template** for saved voxels meant to be copied into a layer, not
  *prefab*, which suggests placed copies that follow later edits.
- Use **layer compositing** for overlap between layers and **occlusion** for
  coverage between neighboring shapes.
- Qualify **face culling** and **chunk culling** instead of using *culling* on
  its own.
- Use **tileset** for the source image grid, **tile** for one image in that
  grid, and **atlas** for the loaded texture used for rendering.
- Use **transparent block** for texture holes and translucency. Layers are
  either visible or hidden.
- Use **meshing** for generating chunk surfaces.
