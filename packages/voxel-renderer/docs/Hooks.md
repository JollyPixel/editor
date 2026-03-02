# Hooks

Hooks allow you to listen for changes in the `VoxelRenderer`, for example when a layer
is added, removed or updated. They are particularly useful for synchronizing voxel-world
changes between multiple clients or systems.

```ts
import {
  VoxelRenderer,
  type VoxelLayerHookEvent
} from "@jolly-pixel/voxel-renderer";

function onLayerUpdated(
  event: VoxelLayerHookEvent
): void {
  // Narrow on `action` to get a fully-typed `metadata`.
  if (event.action === "voxel-set") {
    console.log(event.metadata.position, event.metadata.blockId);
  }
}

const vr = new VoxelRenderer({
  onLayerUpdated,
});
```

## Event reference

`VoxelLayerHookEvent` is a discriminated union keyed on `action`. Narrowing on `action`
gives you a precise `metadata` type with no casting required.

| `action` | `metadata` shape |
|---|---|
| `"added"` | `{ options: VoxelLayerConfigurableOptions }` |
| `"removed"` | `{}` |
| `"updated"` | `{ options: Partial<VoxelLayerConfigurableOptions> }` |
| `"offset-updated"` | `{ offset: VoxelCoord }` or `{ delta: VoxelCoord }` |
| `"voxel-set"` | `{ position, blockId, rotation, flipX, flipZ, flipY }` |
| `"voxel-removed"` | `{ position: Vector3Like }` |
| `"reordered"` | `{ direction: "up" \| "down" }` |
| `"object-layer-added"` | `{}` |
| `"object-layer-removed"` | `{}` |
| `"object-layer-updated"` | `{ patch: { visible?: boolean } }` |
| `"object-added"` | `{ objectId: string }` |
| `"object-removed"` | `{ objectId: string }` |
| `"object-updated"` | `{ objectId: string; patch: Partial<VoxelObjectJSON> }` |

`VoxelLayerHookAction` is a convenience alias for `VoxelLayerHookEvent["action"]`.
