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
  | "added"
  | "removed"
  | "updated"
  | "offset-updated"
  | "voxel-set"
  | "voxel-removed"
  | "reordered";

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
