export type VoxelLayerHookAction =
  | "added"
  | "removed"
  | "updated"
  | "offset-updated"
  | "voxel-set"
  | "voxel-removed"
  | "reordered";

export interface VoxelLayerHookEvent {
  layerName: string;
  action: VoxelLayerHookAction;
  metadata: Record<string, any>;
}
export type VoxelLayerHookListener = (
  event: VoxelLayerHookEvent
) => void;
