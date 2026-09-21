<h1 align="center">
  asset.voxel-model
</h1>

## 💃 Getting Started

This workspace-private package is never published. Add it as a dependency of
another workspace:

```json
{
  "dependencies": {
    "@jolly-pixel/asset.voxel-model": "workspace:*"
  }
}
```

## 👀 Usage example

Serve voxel models through the asset workspace, with their texture as a
pixel-art asset:

```ts
import { pixelArtAssetKind } from "@jolly-pixel/asset.pixel-art";
import {
  createVoxelModelDocument,
  encodeVoxelModelDocument,
  voxelModelAssetKind
} from "@jolly-pixel/asset.voxel-model";

createAssetWorkspacePlugin({
  root,
  handlers: [
    voxelModelAssetKind(),
    pixelArtAssetKind({ defaultSize: { x: 64, y: 64 } })
  ],
  seed: {
    "models/model.voxelmodel.json": () => encodeVoxelModelDocument(
      createVoxelModelDocument({
        texture: { id: "model-texture", kind: "pixelart" }
      })
    )
  }
});
```

## 📚 API

### Kind

`VOXEL_MODEL_KIND` is `"voxelmodel"`. `voxelModelAssetKind(options?)`
claims every `.voxelmodel.json` path (`VOXEL_MODEL_EXTENSION`) and appends
`voxelmodel.command` events (`VOXEL_MODEL_COMMAND`).

| Option | Default | Description |
|---|---|---|
| `snapshot` | asset-server default | Snapshot cadence. |
| `conflictResolver` | last write wins | Resolves concurrent edits of one node's name, parent or transform. |

`dependencies(state)` returns the model's `texture` reference, so the
catalog tracks the texture as a dependency and an editor session leases it.

### Document

```ts
interface VoxelModelDocument {
  version: 2;
  nodes: ModelNodeJSON[];
  texture?: AssetReferenceData;
}

type ModelNodeJSON =
  | { kind: "folder"; id: string; parentId: string | null; name: string; }
  | {
    kind: "block";
    id: string;
    parentId: string | null;
    name: string;
    transform: BlockTransformJSON;
    flipAxes?: MirrorAxes;
  };
```

Blocks and folders share one tree: `parentId` names either kind. A folder
carries no transform, so a block inherits from the nearest block above it.

`createVoxelModelDocument({ texture?, blocks? })`,
`encodeVoxelModelDocument(document)` and `decodeVoxelModelDocument(bytes)`
build and (de)serialize it. A new document starts with one root block named
`Block`; `blocks` names the root blocks to create instead, and `[]` leaves the
model empty.
`decodeVoxelModelDocument` throws `InvalidVoxelModelDocumentError` on a
malformed document.

### Model tree

`ModelTree` is the reducer the room and the editor share. `accepts(command)`
validates, `apply(command)` mutates, `load(nodes)` replaces the content, and
every read returns a copy.

| Member | Description |
|---|---|
| `get(id)`, `block(id)`, `has(id)`, `size` | Node lookup; `block` ignores folders. |
| `values()`, `blocks()` | Every node, or every block, in insertion order. |
| `childrenOf(parentId)` | Direct children; `null` lists the roots. |
| `subtreeOf(id)` | The node then its descendants, parents first. |
| `enclosingBlockOf(id)` | The nearest block at or above `id`, or `null`. |
| `transformParentOf(id)` | The block `id` inherits its transform from, or `null`. |

`ModelTreeReader` is the same surface without `apply`, `load` and `clear`.
`createBlockTransform(overrides?)` returns the identity transform of a unit
block.

### One room, one command stream

| Command | Payload | Accepted when |
|---|---|---|
| `node-added` | `node` | The id is new and the parent is `null` or known. |
| `node-removed` | `id` | The node exists. Its whole subtree goes with it. |
| `node-renamed` | `id`, `name` | The node exists. |
| `node-moved` | `id`, `parentId`, `transforms` | The node and parent exist, the parent is outside the node's subtree, and every transform targets a block. |
| `node-transformed` | `id`, `transform`, `flipAxes?` | The node is a block. |

`node-moved` carries the new local transforms of the blocks whose transform
parent changes, so a move that keeps world poses stays one atomic command.
The snapshot is `{ nodes }`.

The command union, the snapshot and the node shapes are inferred from the JSON
Schema that validates the room, so `voxelModelCommandSchema` and its siblings
on `network/server.ts` are the single source of truth for the wire format.

`VoxelModelCommandArbiter` resolves conflicts per node aspect: `name:<id>`,
`parent:<id>` and `transform:<id>`. A `node-moved` claims the parent key and
the transform key of every block it rewrites.

### Entry points

| Import | Contents |
|---|---|
| `@jolly-pixel/asset.voxel-model` | Handler, state, document codec, model tree and wire types. |
| `@jolly-pixel/asset.voxel-model/network/client.ts` | Wire types, `ModelTree`, `createBlockTransform()` and `VOXEL_MODEL_KIND`, browser-safe. |
| `@jolly-pixel/asset.voxel-model/network/server.ts` | Command schema and the command arbiter. |
