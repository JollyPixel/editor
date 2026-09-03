# Hooks

Hooks report voxel, layer, and object-layer changes from `VoxelEngine`. They are
useful for synchronizing a voxel world with another client or system.

```ts
import {
  VoxelEngine,
  type VoxelLayerHookEvent
} from "@jolly-pixel/voxel.renderer";

function onLayerUpdated(
  event: VoxelLayerHookEvent
): void {
  // Narrow on `action` to get a fully-typed `metadata`.
  if (event.action === "voxel-set") {
    console.log(event.metadata.position, event.metadata.blockId);
  }
}

const engine = new VoxelEngine({
  onLayerUpdated
});
```

You can also set (or replace) the hook after construction:

```ts
engine.onLayerUpdated = (event) => { /* ... */ };
// Clear the hook:
engine.onLayerUpdated = undefined;
```

When wrapped by `VoxelRenderer`, the same hook lives at `vr.engine.onLayerUpdated`.

## Event reference

`VoxelLayerHookEvent` is a discriminated union keyed on `action`. Narrowing on `action`
gives you a precise `metadata` type with no casting required.

| `action` | `metadata` shape | Notes |
|---|---|---|
| `"added"` | `{ options: VoxelLayerConfigurableOptions }` | |
| `"removed"` | `{}` | |
| `"updated"` | `{ options: Partial<VoxelLayerConfigurableOptions> }` | |
| `"cloned"` | `{ options: PartialExcept<VoxelLayerOptions, "name"> }` | `layerName` is the source layer. |
| `"merged"` | `{ targetLayerName: string }` | `layerName` is the source layer. |
| `"offset-updated"` | `{ offset: VoxelCoord }` or `{ delta: VoxelCoord }` | |
| `"voxel-set"` | `{ position, blockId, rotation, flipX, flipZ, flipY }` | |
| `"voxel-removed"` | `{ position: Vector3Like }` | |
| `"voxels-set"` | `{ entries: VoxelSetOptions[] }` | Bulk placement |
| `"voxels-removed"` | `{ entries: VoxelRemoveOptions[] }` | Bulk removal |
| `"reordered"` | `{ direction: "up" \| "down" }` | |
| `"object-layer-added"` | `{}` | |
| `"object-layer-removed"` | `{}` | |
| `"object-layer-updated"` | `{ patch: { visible?: boolean } }` | |
| `"object-added"` | `{ object: VoxelObjectJSON }` | Full object, not just ID |
| `"object-removed"` | `{ objectId: string }` | |
| `"object-updated"` | `{ objectId: string; patch: Partial<VoxelObjectJSON> }` | |

## Block definitions

Block definitions belong to the document rather than to a layer, so they are
reported on a second hook with its own union:

```ts
type VoxelBlockHookEvent =
  | { action: "block-defined"; block: ResolvedBlockDefinition; }
  | { action: "block-removed"; blockId: number; };
```

| Action | Payload | Notes |
|---|---|---|
| `"block-defined"` | `{ block: ResolvedBlockDefinition }` | Resolved, not the raw input |
| `"block-removed"` | `{ blockId: number }` | Only for an ID that was registered |

```ts
engine.onBlockUpdated = (event) => { /* ... */ };
```

Only `engine.defineBlock()`, `engine.defineBlocks()` and `engine.removeBlock()`
emit it; a direct `engine.blockRegistry.register()` does not. Use the registry
directly for definitions each peer derives on its own, and the engine methods
for edits that must reach other systems.

`VoxelBlockHookAction` and `VOXEL_BLOCK_HOOK_ACTIONS` mirror their layer
equivalents.

## Aliases

`VoxelLayerHookAction` is a convenience alias for `VoxelLayerHookEvent["action"]`.
`VOXEL_LAYER_HOOK_ACTIONS` contains the same action vocabulary for integrations
that need a runtime list. The `"object-added"` event carries the full object in
`metadata.object`, so a remote consumer can reconstruct it without another lookup.
