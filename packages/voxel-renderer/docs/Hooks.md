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
  // Send information over the network
  console.log(event);
}

const vr = new VoxelRenderer({
  onLayerUpdated,
});
```

## Types

```ts
export type VoxelLayerHookAction =
  // Voxel-layer actions
  | "added"            // a voxel layer was created
  | "removed"          // a voxel layer was deleted
  | "updated"          // layer properties (visibility, …) changed
  | "offset-updated"   // layer world offset changed
  | "voxel-set"        // a voxel was placed in a layer
  | "voxel-removed"    // a voxel was removed from a layer
  | "reordered"        // layer render order changed
  // Object-layer actions
  | "object-layer-added"   // a new object layer was created
  | "object-layer-removed" // an object layer was deleted
  | "object-layer-updated" // object layer properties (e.g. visibility) changed
  | "object-added"         // an object was added to an object layer
  | "object-removed"       // an object was removed from an object layer
  | "object-updated";      // an object's properties were patched

// Describes a change related to a layer.
export interface VoxelLayerHookEvent {
  // The name of the affected layer.
  layerName: string;

  // The action that occurred on the layer.
  action: VoxelLayerHookAction;

  // Additional data related to the action.
  // Use `unknown` to encourage callers
  // to validate the payload before use.
  metadata: Record<string, unknown>;
}

export type VoxelLayerHookListener = (
  event: VoxelLayerHookEvent
) => void;
```
