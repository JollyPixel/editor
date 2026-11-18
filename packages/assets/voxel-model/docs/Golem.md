# Golem

`@jolly-pixel/asset.voxel-model/golem` lets a golem open `voxelmodel` assets. Its `GOLEM_KINDS` export is what `@jolly-pixel/golem` imports for the kind when the studio lists this package; `golem.open(assetId, "voxelmodel")` then returns the class below. Importing the entry adds the kind to the `GolemAssets` interface of `@jolly-pixel/golem.kit`, which types that call.

An agent reaches the same edits through the MCP server: `asset_open` answers the guide in `src/golem/guide.md` and the intents below with their input schema, and `asset_intent` runs one.

## Intents

- `addMaterials` and `addBlocks`: each runs the method of the same name with its input and answers what the method returns.

## `VoxelModelAsset`

The asset for `voxelmodel`. Commands are the model's `VoxelModelCommand`: nodes (folders and blocks), materials and animation sets. Node and material arguments take a name or an id; a name matching nothing, or several entries, throws `UnknownEntryError` with the ids in `error.candidates`.

```ts
const model = await golem.open(assetId, "voxelmodel");
await model.addMaterials({ materials: [{ name: "Steel", surface: { metalness: 1 } }] });
await model.addBlocks({ blocks: [{ name: "Arm", material: "Steel", shape: { type: "cylinder", sides: 8 } }] });
await model.settled();
```

### `tree: ModelTreeReader`

The live node and material trees.

### `read(): VoxelModelSnapshot`

The nodes, materials and animation sets as the model file stores them.

### `addBlocks({ parent?, blocks }): Promise<AddedBlock[]>`

Adds the `BlockSpec` `blocks` under `parent`, a node name or id, or at the root, and returns `{ id, name, uv, shared }` for each. Each block's UV net goes in the first free space on the model's pixel-art texture, as the editor places a new block. When the nets do not fit, the golem first resizes the texture, doubling its shorter side until they do; existing pixels keep their place. `uv` is the `{ x, y, width, height }` the net covers, to paint through the texture's `pixels`. `shared` is `true` only when the texture reached its largest size and the net overlaps another one. The lock check runs before the resize: a `LockedByPeerError` leaves the texture as it was.

```ts
interface BlockSpec {
  name: string;
  shape?: BlockShapeJSON; // default { type: "box" }
  transform?: Partial<BlockTransformJSON>; // missing fields: position, rotation, pivot 0, size and scale 1
  material?: string; // a material name or id
}
```

### `addMaterials({ materials }): Promise<AddedEntry[]>`

Adds `materials` at the root of the material tree from `{ name, surface? }`, missing surface fields taking the default, and returns `{ id, name }` for each.

### Locks

Before sending a batch, `apply` reads the peers' locks and throws `LockedByPeerError` when one holds what the batch edits: the transform lock of a block that is moved, transformed or removed, or the field lock of a material field that is renamed, changed or removed with its material. `holdsModelLock` from `@jolly-pixel/asset.voxel-model` decides which lock covers which value. `error.peer` names the peer and `error.target` what it holds. Wait, or ask in the chat.

### Focus

After each batch, the golem's block mark (`block`) moves to the last block the batch touched, as the voxel-model editor shows a person's selection.

## How it works

- `AddBlocksInput` and `AddMaterialsInput`, with their `BlockSpec` and `MaterialSpec`, are the output types of the zod schemas the `addBlocks` and `addMaterials` intents parse, built from the model's block shape, transform and surface schemas, so the SDK and the intents take the same input.
- A kind whose editor has locks overrides `guard(batch)`, which `apply` calls before applying the batch. `VoxelModelAsset` calls `assertModelUnlocked` with its `peers()`, which asks `holdsModelLock` from `@jolly-pixel/asset.voxel-model` whether a peer's presence locks one of the conflict refs in the batch's `modelFootprint`.
- `VoxelModelAsset.addBlocks` opens the model's texture (`linkedTextureId`) through `studio.open` and lays the nets out with `BlockUvLayouts.place`, which also returns the texture size they fit in. It runs `guard` on the new blocks before resizing the texture, so a locked model leaves the texture as it was.
