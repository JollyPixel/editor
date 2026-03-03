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

You can also set (or replace) the hook after construction:

```ts
vr.onLayerUpdated = (event) => { /* ... */ };
// Clear the hook:
vr.onLayerUpdated = undefined;
```

## Event reference

`VoxelLayerHookEvent` is a discriminated union keyed on `action`. Narrowing on `action`
gives you a precise `metadata` type with no casting required.

| `action` | `metadata` shape | Notes |
|---|---|---|
| `"added"` | `{ options: VoxelLayerConfigurableOptions }` | |
| `"removed"` | `{}` | |
| `"updated"` | `{ options: Partial<VoxelLayerConfigurableOptions> }` | |
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

`VoxelLayerHookAction` is a convenience alias for `VoxelLayerHookEvent["action"]`.

## Breaking change: `"object-added"` metadata

Prior to the network sync layer, the `"object-added"` event carried `{ objectId: string }`.
It now carries `{ object: VoxelObjectJSON }` so remote commands can fully reconstruct the
object without an extra lookup. Update existing consumers:

```ts
// Before
if (event.action === "object-added") {
  console.log(event.metadata.objectId);
}

// After
if (event.action === "object-added") {
  console.log(event.metadata.object.id); // same value, richer payload
}
```
