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

document.tree.transformParentOf(document.tree.childrenOf(arms)[0].id); // body
```

## Nodes

A model tree holds blocks and folders. A folder only sorts nodes. A block is a box with a transform, a UV layout and an optional material:

- `position` is the block's pivot, relative to its transform parent's pivot. `pivotOffset` is where that pivot sits on the box, from the box center along the box's own axes.
- `scale` applies around the pivot and carries the child blocks. A child takes its parent's scale on the same axis, whatever its rotation, so children never skew.
- `uv` is the block's `UVLayoutData` from `@jolly-pixel/asset.pixel-art`: where its faces sit on the model's texture.

## Editing

| Method | Description |
|---|---|
| `addBlock({ name, parentId?, id?, beforeId?, transform?, uv?, materialId? })` | Adds a block and returns its ID, or `null`. It defaults to `BlockTransform.create()` and `BlockUvLayouts.net()`. |
| `addFolder({ name, parentId?, id?, beforeId? })` | Adds a folder and returns its ID, or `null`. |
| `remove(id)` | Removes a node and its subtree. |
| `rename(id, name)` | Renames a node. |
| `move(id, parentId, { transforms?, beforeId? }?)` | Moves a node, with the block transforms the move rewrites. A node cannot move into its own subtree. |
| `transform(id, transform, flipAxes?)` | Sets a block's transform. A `flipAxes` with no axis set clears the block's flip. |
| `setUv(id, uv)` | Sets a block's whole UV layout. |
| `assignMaterial(id, materialId)` | Points a block to a material, or to none with `null`. |

The edit methods return `false` when the tree refuses the command, and the `add*` methods `null`. Without an `id`, the `add*` methods give the node a random ID of 12 letters and digits. A node lands before the sibling `beforeId`, or last among its siblings without one. Parents must exist, IDs must be unused, and transforms, UV layouts and materials target blocks.

## Reading the tree

`document.tree` is a `ModelTreeReader`. Reads return copies.

| Member | Description |
|---|---|
| `size`, `has(id)`, `get(id)`, `values()` | The nodes, in tree order. |
| `block(id)`, `blocks()` | Blocks only. |
| `childrenOf(parentId)`, `nextSiblingOf(id)`, `subtreeOf(id)` | Sibling order and subtrees. `parentId` is `null` for the root. |
| `transformParentOf(id)` | The nearest block above a node, folders skipped, or `null`. |
| `enclosingBlockOf(id)` | The node itself when it is a block, else its transform parent. |
| `materialIdOf(id)` | A block's `materialId`. |
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
| `BlockTransform.create(overrides?)` | The identity transform of a unit block, with `overrides` applied. |
| `BlockTransform.compact(transform)` | A copy holding only the vectors that differ from `BlockTransform.create()`. `BlockTransform.create(compact)` restores the full transform. |
| `BlockTransform.parse(value)` | A copy holding only the five vectors of a transform, or `undefined` when one is missing or is not three numbers. Use it on transforms received from peers. |
| `new BlockTransform(rest)` | Holds a copy of a block's rest transform. |
| `pose(sample)`, `deltaTo(pose)` | Poses the rest transform with an animation sample, and the reverse. See [animation bindings](./animation.md#posing). |

## `BlockUvLayouts`

| Member | Description |
|---|---|
| `BlockUvLayouts.net(origin?)` | The six faces of a block unfolded as a net at `origin`, the texture origin by default. |
| `new BlockUvLayouts(layouts)` | Reads a set of block layouts. |
| `extent` | The smallest texture size that holds every layout. |
| `nextNet(textureSize)` | A net in the first free cell, row by row, or at the texture origin once the texture is full. |
