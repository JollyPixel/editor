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
| `conflictResolver` | last write wins | Resolves concurrent edits of one group, folder or placement. |

`dependencies(state)` returns the model's `texture` reference, so the
catalog tracks the texture as a dependency and an editor session leases it.

### Document

```ts
interface VoxelModelDocument {
  version: 1;
  nodes: ModelNodeJSON[];
  folders: FolderNodeJSON[];
  placements: FolderPlacementJSON[];
  texture?: AssetReferenceData;
}
```

`createVoxelModelDocument({ texture?, blocks? })`,
`encodeVoxelModelDocument(document)` and `decodeVoxelModelDocument(bytes)`
build and (de)serialize it. A new document starts with one root block named
`Block`; `blocks` names the root blocks to create instead, and `[]` leaves the
model empty.
`decodeVoxelModelDocument` throws `InvalidVoxelModelDocumentError` on a
malformed document.

### One room, one command stream

Model and folder commands share the asset's room and its `voxelmodel.command`
protocol: `VoxelModelCommand` is the union of `ModelCommand` (`group-*`) and
`FolderCommand` (`folder-*`, `block-placed`, `block-unplaced`). The snapshot is
`{ nodes, folders, placements }`. `isModelCommand()` splits the stream on
the client.

Both unions, the snapshot and the node shapes are inferred from the JSON
Schema that validates the room, so `modelCommandSchema` and its siblings on
`network/server.ts` are the single source of truth for the wire format.

The room ignores an edit of an unknown group or folder. Placements are always
accepted. `VoxelModelCommandArbiter` resolves conflicts per group, folder
and placement.

### Entry points

| Import | Contents |
|---|---|
| `@jolly-pixel/asset.voxel-model` | Handler, state, document codec and wire types. |
| `@jolly-pixel/asset.voxel-model/network/client.ts` | Wire types, `VOXEL_MODEL_KIND` and `isModelCommand()`, browser-safe. |
| `@jolly-pixel/asset.voxel-model/network/server.ts` | Command schema and the command arbiter. |
