# Model document

Exported from `@jolly-pixel/asset.voxel-model/client`. `ModelDocument` is the editable model: its methods validate a command, apply it locally and emit a `change` with `origin: "local"`. `tree` reads the result. Materials and animation links have their own pages: [material library](./materials.md) and [animation bindings](./animation.md).

```ts
import {
  BlockTransform,
  ModelDocument
} from "@jolly-pixel/asset.voxel-model/client";

const document = new ModelDocument();
const body = document.addBlock({ name: "Body" })!;
const arms = document.addFolder({ name: "Arms", parentId: body })!;
document.addBlock({
  name: "Arm.L",
  parentId: arms,
  transform: BlockTransform.create({ position: { x: 1, y: 0, z: 0 } })
});

document.tree.findTransformParent(document.tree.listChildren(arms)[0].id); // body
```

## Nodes

A model tree holds blocks and folders. A folder only sorts nodes. A block has a shape, a transform, a UV layout and an optional material:

- `shape` is a `BlockShapeJSON`: `{ type: "box" }`, `{ type: "plane" }`, a round shape `{ type: "cylinder" | "cone", sides }` with a whole number of 3 to 32 `sides`, or a torus `{ type: "torus", sides, ringSides, thickness }` whose `ringSides` (3 to 32) go around its tube and whose `thickness` (0.05 to 0.95) is the tube's width as a share of the outer radius. A box block stores no `shape`. Every shape fills the block's `size`: a plane lies flat in X and Z, facing up, and ignores `size.y`; a round shape stands along Y on a regular polygon stretched until its edges touch the size, with its first side facing front, and a cone ends in a point at the top. A cone with 4 sides is a pyramid. A torus lies flat: its outer edge touches the size in X and Z and its tube spans the full height.

- `position` is the block's pivot, relative to its transform parent's pivot. `pivotOffset` is where that pivot sits on the box, from the box center along the box's own axes.
- `scale` applies around the pivot and carries the child blocks. A child takes its parent's scale on the same axis, whatever its rotation, so children never skew.
- `uv` is the block's `UVLayoutData` from `@jolly-pixel/asset.pixel-art`: where its faces sit on the model's texture.

## Editing

| Method | Description |
|---|---|
| `addBlock({ name, parentId?, id?, beforeId?, transform?, shape?, uv?, materialId? })` | Adds a block and returns its ID, or `null`. It defaults to `BlockTransform.create()`, a box, and the `BlockUvLayouts.net()` of its shape. |
| `addFolder({ name, parentId?, id?, beforeId? })` | Adds a folder and returns its ID, or `null`. |
| `remove(id)` | Removes a node and its subtree. |
| `rename(id, name)` | Renames a node. |
| `move(id, parentId, { transforms?, beforeId? }?)` | Moves a node, with the block transforms the move rewrites. A node cannot move into its own subtree. |
| `transform(id, transform, flipAxes?)` | Sets a block's transform. A `flipAxes` with no axis set clears the block's flip. |
| `updateUv(id, uv)` | Sets a block's whole UV layout. |
| `updateShape(id, shape, uv)` | Sets a block's shape and its whole UV layout in one command, since a UV layout only fits the faces of one shape. |
| `assignMaterial(id, materialId)` | Points a block to a material, or to none with `null`. |

The edit methods return `false` when the tree refuses the command, and the `add*` methods `null`. Without an `id`, the `add*` methods give the node a random ID of 12 letters and digits. A node lands before the sibling `beforeId`, or last among its siblings without one. Parents must exist, IDs must be unused, and transforms, UV layouts and materials target blocks.

## Reading the tree

`document.tree` is a `ModelTreeReader`. Reads return copies.

| Member | Description |
|---|---|
| `size`, `has(id)`, `get(id)`, `values()` | The nodes, in tree order. |
| `block(id)`, `blocks()` | Blocks only. |
| `listChildren(parentId)`, `findNextSibling(id)`, `subtreeFrom(id)` | Sibling order and subtrees. `parentId` is `null` for the root. |
| `findTransformParent(id)` | The nearest block above a node, folders skipped, or `null`. |
| `findEnclosingBlock(id)` | The node itself when it is a block, else its transform parent. |
| `blockMaterialId(id)` | A block's `materialId`. |
| `blocksUsing(materialId)`, `materialUses()` | The blocks pointing to a material, and the number of blocks per material ID. |
| `blockNamesUnder(parentId, exceptId?)` | The `NameSet` of the block names a block placed under `parentId` would sit among. |
| `blockNameClashes()` | The IDs of every block sharing its name with a sibling block. |
| `materials` | The [material library](./materials.md). |
| `animationSets` | The [animation set links](./animation.md). |
| `accepts(command)`, `placeable(command)` | Whether the tree accepts a command, and the command without a `beforeId` the tree would refuse. |

Block names should be unique among the blocks sharing a transform parent, compared trimmed and in any case, because animation tracks find blocks by name path. The tree still accepts clashes: `blockNamesUnder(parentId).free(name)` returns `name`, or the first free `name 2`, `name 3`.

## `BlockTransform`

| Member | Description |
|---|---|
| `NO_FLIP` | The frozen `MirrorAxes` with no axis flipped. |
| `BlockTransform.create(overrides?)` | The identity transform of a unit block, with `overrides` applied. |
| `BlockTransform.compact(transform)` | A copy holding only the vectors that differ from `BlockTransform.create()`. `BlockTransform.create(compact)` restores the full transform. |
| `BlockTransform.parse(value)` | A copy holding only the five vectors of a transform, or `undefined` when one is missing or is not three numbers. Use it on transforms received from peers. |
| `new BlockTransform(rest)` | Holds a copy of a block's rest transform. |
| `pose(sample)`, `deltaTo(pose)` | Poses the rest transform with an animation sample, and the reverse. See [animation bindings](./animation.md#posing). |

## `BlockShape`

| Member | Description |
|---|---|
| `BLOCK_SHAPE_TYPES` | Every shape type: `"box"`, `"plane"`, `"cylinder"`, `"cone"`, `"torus"`. |
| `BLOCK_SHAPE_PARAMETERS` | The `min`, `max`, `step` and `default` of each shape parameter: `sides` (3 to 32, step 1, 8), `ringSides` (3 to 32, step 1, 6) and `thickness` (0.05 to 0.95, step 0.05, 0.35). |
| `BlockShape.box` | The frozen box shape. |
| `BlockShape.create(type)` | A shape of `type`, with the default sides, ring sides and thickness it needs. |
| `BlockShape.fromBlock(block)` | A copy of a block's shape, a box when it stores none. |
| `BlockShape.slots(shape)` | The UV slots of a shape: the six box faces, `top` for a plane, for a cylinder or cone `side-0` to `side-<sides - 1>` then `top` (cylinder only) and `bottom`, and for a torus `side-0` to `side-<sides - 1>`, one per segment around the ring, each wrapping the whole tube. |
| `BlockShape.sideSlots(sides)` | `side-0` to `side-<sides - 1>`. |
| `BlockShape.isSideSlot(slot)` | Whether `slot` is one of those side slots. |
| `BlockShape.isRound(shape)` | Whether the shape has sides: a cylinder, cone or torus. |
| `BlockShape.isPointed(shape)` | Whether the sides meet at an apex, as on a cone. Each side is then a triangle. |
| `BlockShape.parameters(shape)` | The parameters the shape has, each as `{ key, value, min, max, step, default }`. |
| `BlockShape.withParameter(shape, key, value)` | A copy of the shape with `value` snapped to the parameter's step and clamped to its range. Throws a `RangeError` when the shape has no such parameter. |
| `BlockShape.same(left, right)` | Whether two shapes have the same type and the same values. |
| `BlockShape.applyTo(block, shape)` | A copy of a block with `shape`, without a `shape` field for a box. |

## `BlockUvLayouts`

| Member | Description |
|---|---|
| `BlockUvLayouts.ORIGIN` | The texture origin, `{ x: 0, y: 0 }`. |
| `BlockUvLayouts.net(origin?, shape?)` | The default layout of a shape, a box by default, at `origin`, `ORIGIN` by default: a box or plane unfolded as a net of 16-pixel cells, a round shape stacked with every face on one 16-pixel cell. A cone's side cells are triangles pointing up, a compound of two halves, so the texture pane shows the face's real outline. |
| `new BlockUvLayouts(layouts)` | Reads a set of block layouts. |
| `extent` | The smallest texture size that holds every layout. |
| `nextNet(textureSize, shape?)` | A net in the first free cell, row by row, or at the texture origin once the texture is full. |
| `reshaped(layout, from, to, textureSize)` | The layout of a block going from shape `from` to `to`. Read the other blocks' layouts only, without the one being reshaped. When the type changes, it is the net of `to` starting where `layout` starts, when that stays inside the texture and overlaps none of the layouts read, else `nextNet(textureSize, to)`. When the type stays (only sides, ring sides or thickness change), faces that remain keep their cells and pixels, dropped faces leave the layout, and new faces share the cell of a stacked layout or, otherwise, take free cells the size of the last remaining side. |
