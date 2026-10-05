# Commands

Every change to a [`VoxelDocument`](./VoxelDocument.md) is a `VoxelCommand`.
The document emits each one on its `"command"` event and replays one with
`apply()`.

```ts
import {
  VoxelDocument,
  isVoxelLayerCommand,
  type VoxelCommandListener
} from "@jolly-pixel/voxel.renderer";

const onCommand: VoxelCommandListener = (command, { origin }) => {
  if (isVoxelLayerCommand(command) && command.action === "voxel-set") {
    console.log(origin, command.metadata.position);
  }
};

const document = new VoxelDocument({ onCommand });
```

## Origin

```ts
type VoxelCommandListener = (
  command: VoxelCommand,
  context: { origin: "local" | "remote" }
) => void;
```

`origin` is `"local"` for a change made on this document and `"remote"` for one
replayed with `document.apply(command, { origin: "remote" })`. A network
adapter applies peer commands as `"remote"` and sends only `"local"` ones.

## Categories

```ts
type VoxelCommand =
  | VoxelLayerCommand
  | VoxelTemplateCommand
  | VoxelBlockCommand
  | VoxelTilesetCommand
  | VoxelMaterialGroupCommand
  | VoxelBlendGroupCommand;
```

| Category | Guard | Actions list |
| --- | --- | --- |
| [Layer](#layer-commands) | `isVoxelLayerCommand()` | `VOXEL_LAYER_COMMAND_ACTIONS` |
| [Template](#template-commands) | `isVoxelTemplateCommand()` | `VOXEL_TEMPLATE_COMMAND_ACTIONS` |
| [Block](#block-commands) | `isVoxelBlockCommand()` | `VOXEL_BLOCK_COMMAND_ACTIONS` |
| [Tileset](#tileset-commands) | `isVoxelTilesetCommand()` | `VOXEL_TILESET_COMMAND_ACTIONS` |
| [Material group](#material-group-commands) | `isVoxelMaterialGroupCommand()` | `VOXEL_MATERIAL_GROUP_COMMAND_ACTIONS` |
| [Blend group](#blend-group-commands) | `isVoxelBlendGroupCommand()` | `VOXEL_BLEND_GROUP_COMMAND_ACTIONS` |
| All | | `VOXEL_COMMAND_ACTIONS` |

Within layer commands, `isVoxelEditCommand()` matches voxel edits and
`isVoxelObjectLayerCommand()` matches object layer commands.
`isVoxelLayerGeometryCommand()` matches voxel edits plus `"position-updated"`
and `"position-rebased"`, the commands that change a layer's bounds. Each guard
accepts any `{ action: string }`. `VoxelCommandAction` and the per-category
`*CommandAction` types are the matching unions.

## World and tileset document commands

The same commands also split by owner. A world saves and shares its layers,
templates and tileset links; blocks and groups belong to a
[`TilesetDocument`](../tilesets/TilesetDocument.md).

```ts
type VoxelWorldContentCommand = VoxelLayerCommand | VoxelTemplateCommand;
type VoxelWorldCommand = VoxelWorldContentCommand | VoxelTilesetCommand;
type TilesetDocumentCommand =
  | VoxelBlockCommand
  | VoxelMaterialGroupCommand
  | VoxelBlendGroupCommand
  | { action: "tile-size-updated"; tileSize: number; };
```

`isVoxelWorldCommand()` and `isTilesetDocumentCommand()` narrow to either side;
`VOXEL_WORLD_COMMAND_ACTIONS` and `TILESET_DOCUMENT_COMMAND_ACTIONS` list them.
A sync adapter sends the world side of a document's stream to the world's room.

## Applying commands

```ts
function applyVoxelCommand(
  target: VoxelCommandTarget,
  command: VoxelCommand,
  logger?: VoxelLogger
): VoxelCommand | null;

function applyVoxelWorldCommand(
  target: VoxelWorldCommandTarget,
  command: VoxelWorldCommand,
  logger?: VoxelLogger
): VoxelWorldCommand | null;

interface VoxelWorldCommandTarget {
  readonly world: VoxelWorld;
  readonly tilesets: TilesetList;
}

interface VoxelCommandTarget extends VoxelWorldCommandTarget {
  readonly blocks: BlockRegistry;
  readonly materialGroups: MaterialGroupList;
  readonly blendGroups: BlendGroupList;
}
```

Apply a command to plain state, such as a server's, and return it as applied,
or `null` when nothing changed. Neither emits. `applyVoxelWorldCommand()` needs
no block registry or groups. `document.apply()` uses `applyVoxelCommand()` and
then emits the result.

## Layer commands

Layer commands carry `layerId` (voxel layers) or `layerName` (object layers),
and a `metadata` object. `VoxelWorld` emits them; the document forwards them as
local commands.

| `action` | `metadata` | Notes |
| --- | --- | --- |
| `"added"` | `{ name, rank, options }` | Refused when `layerId` exists. `name` comes back unique. |
| `"removed"` | `{}` | |
| `"updated"` | `{ options: VoxelLayerUpdate }` | `options.name` renames the layer and comes back unique. |
| `"cloned"` | `{ cloneId, rank, options }` | `layerId` is the source; `options.name` is the resolved name. |
| `"merged"` | `{ targetLayerId }` | `layerId` is the source, which the merge removes. |
| `"position-updated"` | `{ position }` or `{ delta }` | |
| `"position-rebased"` | `{ position }` | |
| `"layer-moved"` | `{ rank }` | The layer's new rank. |
| `"voxel-set"` | `{ position, blockId, rotation, flipX, flipZ, flipY, merge? }` | `merge` only when set, see [merged cells](../world/VoxelWorld.md#merged-cells). |
| `"voxel-removed"` | `{ position }` | |
| `"voxels-set"` | `{ entries: VoxelSetOptions[] }` | |
| `"voxels-removed"` | `{ entries: VoxelRemoveOptions[] }` | |
| `"voxels-patched"` | `VoxelPatch` (`{ cells, partners? }`) | From `transaction()`, `patchVoxels()`, undo/redo and template placement. Five numbers per cell: `x, y, z, blockId, transform`; block `0` removes. `partners` gives the second shape of merged cells, three numbers each: `cell, blockId, transform`, where `cell` is the index of a non-air cell of `cells`; left out when there are none. |
| `"layer-transformed"` | `{ rotation, flipX, flipZ, flipY }` | From `transformLayer()`. |
| `"object-layer-added"` | `{}` | |
| `"object-layer-removed"` | `{}` | |
| `"object-layer-updated"` | `{ patch: { visible? } }` | |
| `"object-added"` | `{ object: VoxelObjectJSON }` | |
| `"object-removed"` | `{ objectId }` | |
| `"object-moved"` | `{ objectId, fromLayerName, toLayerName }` | |
| `"object-updated"` | `{ objectId, patch }` | |

`voxelPatchCells(cells)` iterates a `"voxels-patched"` payload as
`{ x, y, z, blockId, transform }` objects. `VoxelPatchBuilder` builds a patch
one cell at a time, `pickVoxelPatch(patch, cellIndices)` keeps some cells with
their partners renumbered, and `assertVoxelPatch(patch)` throws a `RangeError`
for a malformed payload:

```ts
const patch = new VoxelPatchBuilder()
  .push({ x: 0, y: 0, z: 0 }, packVoxel(1, 0))
  .push({ x: 1, y: 0, z: 0 }, packVoxel(1, 0), packVoxel(2, 16))
  .toPatch();
// { cells: [0, 0, 0, 1, 0, 1, 0, 0, 1, 0], partners: [1, 2, 16] }
```

## Template commands

```ts
type VoxelTemplateCommand =
  | { action: "template-defined"; template: VoxelTemplateJSON; }
  | { action: "template-updated"; templateId: string; patch: VoxelTemplatePatch; }
  | { action: "template-removed"; templateId: string; };
```

- `"template-defined"` carries the whole
  [serialized template](../serialization/serialization.md#templates), voxels
  included, and replaces a template with the same id. Transforming a stored
  template emits it too.
- `"template-updated"` changes `name`, `pivot` or `properties`, never voxels.
- `"template-removed"` is emitted only for an id that existed.

## Block commands

```ts
type VoxelBlockCommand =
  | { action: "block-defined"; block: ResolvedBlockDefinition; }
  | { action: "block-removed"; blockId: number; }
  | { action: "block-moved"; blockId: number; toIndex: number; };
```

- `"block-defined"` carries the resolved definition, default tileset filled in.
- `"block-removed"` is emitted only for a registered ID.
- `"block-moved"` carries the clamped index the block landed on.

Direct `document.blocks` calls emit nothing.

## Tileset commands

```ts
type VoxelTilesetCommand =
  | { action: "tileset-added"; tileset: TilesetDefinition; }
  | { action: "tileset-removed"; tilesetId: string; };
```

`"tileset-added"` carries the [slot](../tilesets/tilesets.md) the tileset
received. `view.load()`, `view.loadTileset()` and direct `document.tilesets`
mutations emit nothing.

## Material group commands

```ts
type VoxelMaterialGroupCommand =
  | { action: "material-group-defined"; group: MaterialGroupJSON; }
  | { action: "material-group-removed"; groupId: string; };
```

The emitted definition has every finish field filled in. See
[MaterialGroup](../materials/MaterialGroup.md).

## Blend group commands

```ts
type VoxelBlendGroupCommand =
  | { action: "blend-group-defined"; group: BlendGroupJSON; }
  | { action: "blend-group-removed"; groupId: string; };
```

The emitted definition has every setting filled in. See
[BlendGroup](../materials/BlendGroup.md).
