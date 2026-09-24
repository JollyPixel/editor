# Commands

Every change to a voxel document is a `VoxelCommand`. The engine emits each one
on its `"command"` event and replays one with `apply()`, so a single listener
and a single entry point cover layers, voxels, objects, blocks, tilesets and
material groups.

```ts
import {
  VoxelEngine,
  isVoxelLayerCommand,
  type VoxelCommandListener
} from "@jolly-pixel/voxel.renderer";

const onCommand: VoxelCommandListener = (command, { origin }) => {
  if (isVoxelLayerCommand(command) && command.action === "voxel-set") {
    console.log(origin, command.metadata.position);
  }
};

const engine = new VoxelEngine({ onCommand });

// Or subscribe later; the engine is an Emitter.
engine.on("command", onCommand);
engine.off("command", onCommand);
```

```ts
type VoxelCommand =
  | VoxelLayerCommand
  | VoxelBlockCommand
  | VoxelTilesetCommand
  | VoxelMaterialGroupCommand;

type VoxelCommandListener = (
  command: VoxelCommand,
  context: VoxelCommandContext
) => void;

interface VoxelCommandContext {
  origin: "local" | "remote";
}
```

`origin` is `"local"` for a change made on this engine and `"remote"` for one
replayed with `engine.apply(command, { origin: "remote" })`. A network adapter
sends only local commands; UI listeners usually ignore the origin.

`isVoxelLayerCommand()`, `isVoxelBlockCommand()`, `isVoxelTilesetCommand()` and
`isVoxelMaterialGroupCommand()` narrow a command (or any `{ action: string }`)
to one category. `VOXEL_COMMAND_ACTIONS` lists every action;
`VOXEL_LAYER_COMMAND_ACTIONS`, `VOXEL_BLOCK_COMMAND_ACTIONS`,
`VOXEL_TILESET_COMMAND_ACTIONS` and `VOXEL_MATERIAL_GROUP_COMMAND_ACTIONS` list
each category. `VoxelCommandAction` and the per-category `*CommandAction` types are
the matching unions.

## Applying commands

```ts
function applyVoxelCommand(
  target: VoxelCommandTarget,
  command: VoxelCommand,
  logger?: VoxelLogger
): boolean;

interface VoxelCommandTarget {
  readonly world: VoxelWorld;
  readonly blocks: BlockRegistry;
  readonly tilesets: TilesetList;
  readonly materialGroups: MaterialGroupList;
}
```

Routes a command to `world.apply()`, `applyBlockCommand()`,
[`applyMaterialGroupCommand()`](../materials/MaterialGroup.md#commands) or
[`applyTilesetCommand()`](../tilesets/tilesets.md#tileset-commands) and returns
whether it changed anything. Layer commands always return `true`. It does not
emit, rebuild meshes or rescale atlases; use it on a headless document such as
a server-side state. `engine.apply()` wraps it with those side effects.

```ts
function applyBlockCommand(
  registry: BlockRegistry,
  command: VoxelBlockCommand
): boolean;
```

Registers, unregisters or moves a block and returns whether the registry
changed.

## Layer commands

`VoxelLayerCommand` is keyed on `action` and always carries `layerName` and
`metadata`. `VoxelWorld` emits them on its own `"command"` event, which the
engine forwards as local commands.

| `action` | `metadata` shape | Notes |
|---|---|---|
| `"added"` | `{ options: VoxelLayerConfigurableOptions }` | |
| `"removed"` | `{}` | |
| `"updated"` | `{ options: Partial<VoxelLayerConfigurableOptions> }` | |
| `"cloned"` | `{ options: PartialExcept<VoxelLayerOptions, "name"> }` | `layerName` is the source layer; `options.name` is the resolved clone name. |
| `"merged"` | `{ targetLayerName: string }` | `layerName` is the source layer, which the merge removes. |
| `"position-updated"` | `{ position: VoxelCoord }` or `{ delta: VoxelCoord }` | |
| `"position-rebased"` | `{ position: VoxelCoord }` | |
| `"voxel-set"` | `{ position, blockId, rotation, flipX, flipZ, flipY }` | |
| `"voxel-removed"` | `{ position: Vector3Like }` | |
| `"voxels-set"` | `{ entries: VoxelSetOptions[] }` | Bulk placement |
| `"voxels-removed"` | `{ entries: VoxelRemoveOptions[] }` | Bulk removal |
| `"voxels-patched"` | `{ cells: VoxelPatchCells }` | Emitted by `transaction()` and `patchVoxels()`. Five numbers per cell: `x, y, z, blockId, transform`; block `0` removes the voxel. |
| `"reordered"` | `{ direction: "up" \| "down" }` | One step; `"up"` raises priority. |
| `"layer-moved"` | `{ toIndex: number }` | Absolute position, already clamped. |
| `"object-layer-added"` | `{}` | |
| `"object-layer-removed"` | `{}` | |
| `"object-layer-updated"` | `{ patch: { visible?: boolean } }` | |
| `"object-added"` | `{ object: VoxelObjectJSON }` | Full object, not just ID |
| `"object-removed"` | `{ objectId: string }` | |
| `"object-moved"` | `{ objectId: string; fromLayerName: string; toLayerName: string }` | `layerName` is the source layer. |
| `"object-updated"` | `{ objectId: string; patch: Partial<VoxelObjectJSON> }` | |

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

`engine.defineBlock()`, `defineBlocks()`, `removeBlock()`, `moveBlock()` and
`apply()` emit them. A direct `engine.blockRegistry.register()` or `moveTo()`
does not; use the registry for definitions each peer derives on its own.

## Tileset commands

```ts
type VoxelTilesetCommand =
  | { action: "tileset-added"; tileset: TilesetDefinition; }
  | { action: "tileset-removed"; tilesetId: string; }
  | { action: "tileset-resized"; tilesetId: string; tileSize: number; }
  | { action: "default-tile-size-updated"; defaultTileSize: number; };
```

`engine.apply()` and its shorthands emit them only when the command changed the
list. `engine.load()`, `engine.loadTileset()` and direct `engine.tilesets`
mutations do not.

## Material group commands

```ts
type VoxelMaterialGroupCommand =
  | { action: "material-group-defined"; group: MaterialGroupJSON; }
  | { action: "material-group-removed"; groupId: string; };
```

`engine.defineMaterialGroup()`, `removeMaterialGroup()` and `apply()` emit
them when the list changed. The emitted definition has every finish field
filled in. See [MaterialGroup](../materials/MaterialGroup.md).
