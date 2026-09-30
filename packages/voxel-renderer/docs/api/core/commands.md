# Commands

Every change to a voxel document is a `VoxelCommand`. A
[`VoxelDocument`](./VoxelDocument.md) emits each one on its `"command"` event
and replays one with `apply()`, so a single listener and a single entry point
cover layers, voxels, objects, blocks, tilesets, material groups and blend
groups.

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

// Or subscribe later; the document is an Emitter.
document.on("command", onCommand);
document.off("command", onCommand);
```

```ts
type VoxelCommand =
  | VoxelLayerCommand
  | VoxelTemplateCommand
  | VoxelBlockCommand
  | VoxelTilesetCommand
  | VoxelMaterialGroupCommand
  | VoxelBlendGroupCommand;

type VoxelCommandListener = (
  command: VoxelCommand,
  context: VoxelCommandContext
) => void;

interface VoxelCommandContext {
  origin: "local" | "remote";
}
```

`origin` is `"local"` for a change made on this document and `"remote"` for one
replayed with `document.apply(command, { origin: "remote" })`. A network adapter
sends only local commands; UI listeners usually ignore the origin.

`isVoxelLayerCommand()`, `isVoxelTemplateCommand()`, `isVoxelBlockCommand()`,
`isVoxelTilesetCommand()`, `isVoxelMaterialGroupCommand()` and
`isVoxelBlendGroupCommand()` narrow a command (or any `{ action: string }`)
to one category. Within layer commands, `isVoxelEditCommand()` and
`isVoxelObjectLayerCommand()` narrow to the
[voxel edit and object layer subsets](#layer-commands).
`isVoxelLayerGeometryCommand()` adds `"position-updated"` and
`"position-rebased"` to the voxel edits: the commands that move a layer's
bounds or center. `VOXEL_COMMAND_ACTIONS` lists every action;
`VOXEL_LAYER_COMMAND_ACTIONS`, `VOXEL_TEMPLATE_COMMAND_ACTIONS`, `VOXEL_BLOCK_COMMAND_ACTIONS`,
`VOXEL_TILESET_COMMAND_ACTIONS`, `VOXEL_MATERIAL_GROUP_COMMAND_ACTIONS` and
`VOXEL_BLEND_GROUP_COMMAND_ACTIONS` list each category. `VoxelCommandAction` and the per-category `*CommandAction` types are
the matching unions.

## World and tileset document commands

A world persists and shares only its layers, templates and tileset links. Blocks,
material groups and blend groups belong to the tileset they come from, so the
same vocabulary is split a second way:

```ts
type VoxelWorldContentCommand =
  | VoxelLayerCommand
  | VoxelTemplateCommand;

type VoxelWorldCommand =
  | VoxelWorldContentCommand
  | VoxelTilesetCommand;

type TilesetDocumentCommand =
  | VoxelBlockCommand
  | VoxelMaterialGroupCommand
  | VoxelBlendGroupCommand
  | { action: "tile-size-updated"; tileSize: number; };
```

`isVoxelWorldCommand()` and `isTilesetDocumentCommand()` narrow to either
half; `VOXEL_WORLD_COMMAND_ACTIONS` and `TILESET_DOCUMENT_COMMAND_ACTIONS`
list them. A sync adapter sends the world half of a document's command stream
to the world's room; the tileset half reaches it through a
[`TilesetDocument`](../tilesets/TilesetDocument.md), which emits the same
block, material group and blend group commands on its own `"command"` event.

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

Routes a command to [`world.apply()`](../world/VoxelWorld.md#commands),
[`blocks.apply()`](../blocks/BlockRegistry.md#api),
[`materialGroups.apply()`](../materials/MaterialGroup.md#commands),
[`blendGroups.apply()`](../materials/BlendGroup.md#commands) or
[`tilesets.apply()`](../tilesets/tilesets.md#tileset-commands) and returns
the command as applied, or `null` when it changed nothing. It does not emit;
use it on a headless state such as a server's. `applyVoxelWorldCommand()`
needs no block registry or groups, which is what a server holding
only worlds folds with. [`document.apply()`](./VoxelDocument.md#methods) wraps
`applyVoxelCommand()` and broadcasts the returned command; a
[`VoxelView`](./VoxelView.md) listening to the document rebuilds meshes and
atlases.

```ts
class BlockRegistry {
  apply(
    command: VoxelBlockCommand,
    defaultTilesetId?: string | null
  ): VoxelBlockCommand | null;
}
```

Registers, unregisters or moves a block. A defined block gets
`defaultTilesetId` in its texture references that name no tileset; a move
comes back with the index the block landed on. Returns `null` when the
registry did not change.

## Layer commands

`VoxelLayerCommand` is keyed on `action` and always carries `metadata`.
Voxel layer commands name their layer by `layerId`, so a rename never
strands a peer's commands; object layer commands name theirs by `layerName`.
`VoxelWorld` emits them on its own `"command"` event, which the document
forwards as local commands.

```ts
type VoxelLayerCommand =
  | VoxelLayerStructureCommand  // added, removed, updated, cloned, merged, position-*, layer-moved
  | VoxelEditCommand            // voxel-set, voxel-removed, voxels-set, voxels-removed, voxels-patched, layer-transformed
  | VoxelObjectLayerCommand;    // object-layer-*, object-*
```

| `action` | `metadata` shape | Notes |
|---|---|---|
| `"added"` | `{ name: string; rank: string; options: VoxelLayerConfigurableOptions }` | `layerId` is the new layer's id; refused when it exists. `name` comes back unique. |
| `"removed"` | `{}` | |
| `"updated"` | `{ options: VoxelLayerUpdate }` | `options.name` renames the layer and comes back unique. |
| `"cloned"` | `{ cloneId: string; rank: string; options: VoxelLayerCloneOptions }` | `layerId` is the source layer; `options.name` is the resolved clone name. |
| `"merged"` | `{ targetLayerId: string }` | `layerId` is the source layer, which the merge removes. |
| `"position-updated"` | `{ position: VoxelCoord }` or `{ delta: VoxelCoord }` | |
| `"position-rebased"` | `{ position: VoxelCoord }` | |
| `"voxel-set"` | `{ position, blockId, rotation, flipX, flipZ, flipY }` | |
| `"voxel-removed"` | `{ position: Vector3Like }` | |
| `"voxels-set"` | `{ entries: VoxelSetOptions[] }` | Bulk placement |
| `"voxels-removed"` | `{ entries: VoxelRemoveOptions[] }` | Bulk removal |
| `"voxels-patched"` | `{ cells: VoxelPatchCells }` | Emitted by `transaction()` and `patchVoxels()`. Five numbers per cell: `x, y, z, blockId, transform`; block `0` removes the voxel. |
| `"layer-transformed"` | `{ rotation, flipX, flipZ, flipY }` | Emitted by `transformLayer()`. Peers turn their own copy of the layer around its content center. |
| `"layer-moved"` | `{ rank: string }` | The layer's new [rank](../world/VoxelWorld.md#layer-ranks). Moves of different layers commute. |
| `"object-layer-added"` | `{}` | |
| `"object-layer-removed"` | `{}` | |
| `"object-layer-updated"` | `{ patch: { visible?: boolean } }` | |
| `"object-added"` | `{ object: VoxelObjectJSON }` | Full object, not just ID |
| `"object-removed"` | `{ objectId: string }` | |
| `"object-moved"` | `{ objectId: string; fromLayerName: string; toLayerName: string }` | `layerName` is the source layer. |
| `"object-updated"` | `{ objectId: string; patch: Partial<VoxelObjectJSON> }` | |

## Template commands

```ts
type VoxelTemplateCommand =
  | { action: "template-defined"; template: VoxelTemplateJSON; }
  | { action: "template-updated"; templateId: string; patch: VoxelTemplatePatch; }
  | { action: "template-removed"; templateId: string; };
```

`VoxelWorld` emits them for [`world.templates`](../world/VoxelTemplates.md)
changes and applies them through `world.apply()`.

| Action | Notes |
|---|---|
| `"template-defined"` | Carries the whole template in its [saved form](../serialization/serialization.md#templates), voxels included, so a peer does not need the source layer. Replaces a template with the same id. |
| `"template-updated"` | Changes `name`, `pivot` or `properties`, never the voxels. |
| `"template-removed"` | Emitted only for an id that existed. |

Placing a template emits a `"voxels-patched"` layer command, not a template
command. Transforming a stored template emits `"template-defined"` with the
turned voxels.

## Block commands

```ts
type VoxelBlockCommand =
  | { action: "block-defined"; block: ResolvedBlockDefinition; }
  | { action: "block-removed"; blockId: number; }
  | { action: "block-moved"; blockId: number; toIndex: number; };
```

| Action | Notes |
|---|---|
| `"block-defined"` | Carries the resolved definition, with the default tileset filled in. |
| `"block-removed"` | Emitted only for an ID that was registered. |
| `"block-moved"` | The emitted `toIndex` is where the block landed, already clamped. |

`document.defineBlock()`, `defineBlocks()`, `removeBlock()`, `moveBlock()` and
`apply()` emit them. A direct `document.blocks.register()` or `moveTo()`
does not; use the registry for definitions each peer derives on its own.

## Tileset commands

```ts
type VoxelTilesetCommand =
  | { action: "tileset-added"; tileset: TilesetDefinition; }
  | { action: "tileset-removed"; tilesetId: string; };
```

`document.apply()` and its shorthands emit them only when the command changed
the list. The emitted `tileset-added` carries the definition as declared, with
the [slot](../tilesets/tilesets.md#definitions) the tileset received.
`document.load()`, `view.load()`, `view.loadTileset()` and direct
`document.tilesets` mutations do not emit.

## Material group commands

```ts
type VoxelMaterialGroupCommand =
  | { action: "material-group-defined"; group: MaterialGroupJSON; }
  | { action: "material-group-removed"; groupId: string; };
```

`document.defineMaterialGroup()`, `removeMaterialGroup()` and `apply()` emit
them when the list changed. The emitted definition has every finish field
filled in. See [MaterialGroup](../materials/MaterialGroup.md).

## Blend group commands

```ts
type VoxelBlendGroupCommand =
  | { action: "blend-group-defined"; group: BlendGroupJSON; }
  | { action: "blend-group-removed"; groupId: string; };
```

`document.defineBlendGroup()`, `removeBlendGroup()` and `apply()` emit them
when the list changed. The emitted definition has every setting filled in.
See [BlendGroup](../materials/BlendGroup.md).
