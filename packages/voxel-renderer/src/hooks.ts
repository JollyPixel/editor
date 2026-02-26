export type VoxelLayerHookAction =
  | "added"
  | "removed"
  | "updated"
  | "offset-updated"
  | "voxel-set"
  | "voxel-removed"
  | "reordered"
  | "object-layer-added"
  | "object-layer-removed"
  | "object-layer-updated"
  | "object-added"
  | "object-removed"
  | "object-updated";

export interface VoxelLayerHookEvent {
  layerName: string;
  action: VoxelLayerHookAction;
  metadata: Record<string, any>;
}
export type VoxelLayerHookListener = (
  event: VoxelLayerHookEvent
) => void;
