// Import Third-party Dependencies
import type { Vector3Like } from "three";

// Import Internal Dependencies
import type { VoxelLayerConfigurableOptions, VoxelLayerOptions } from "./world/VoxelLayer.ts";
import type { VoxelCoord } from "./world/types.ts";
import type {
  VoxelObjectLayerJSON,
  VoxelObjectJSON
} from "./serialization/VoxelSerializer.ts";
import type { VoxelSetOptions, VoxelRemoveOptions, PartialExcept } from "./types.ts";

export type VoxelLayerHookEvent =
  | {
    action: "added";
    layerName: string;
    metadata: {
      options: VoxelLayerConfigurableOptions;
    };
  }
  | {
    action: "removed";
    layerName: string;
    metadata: Record<string, never>;
  }
  | {
    action: "updated";
    layerName: string;
    metadata: {
      options: Partial<VoxelLayerConfigurableOptions>;
    };
  }
  | {
    action: "cloned";
    layerName: string;
    metadata: {
      options: PartialExcept<VoxelLayerOptions, "name">;
    };
  }
  | {
    action: "merged";
    layerName: string;
    metadata: {
      targetLayerName: string;
    };
  }
  | {
    action: "offset-updated";
    layerName: string;
    metadata: { offset: VoxelCoord; } | { delta: VoxelCoord; };
  }
  | {
    action: "voxel-set";
    layerName: string;
    metadata: {
      position: Vector3Like;
      blockId: number;
      rotation: number;
      flipX: boolean;
      flipZ: boolean;
      flipY: boolean;
    };
  }
  | {
    action: "voxel-removed";
    layerName: string;
    metadata: {
      position: Vector3Like;
    };
  }
  | {
    action: "voxels-set";
    layerName: string;
    metadata: {
      entries: VoxelSetOptions[];
    };
  }
  | {
    action: "voxels-removed";
    layerName: string;
    metadata: {
      entries: VoxelRemoveOptions[];
    };
  }
  | {
    action: "reordered";
    layerName: string;
    metadata: {
      direction: "up" | "down";
    };
  }
  | {
    action: "object-layer-added";
    layerName: string;
    metadata: Record<string, never>;
  }
  | {
    action: "object-layer-removed";
    layerName: string;
    metadata: Record<string, never>;
  }
  | {
    action: "object-layer-updated";
    layerName: string;
    metadata: {
      patch: Partial<Pick<VoxelObjectLayerJSON, "visible">>;
    };
  }
  | {
    action: "object-added";
    layerName: string;
    metadata: {
      object: VoxelObjectJSON;
    };
  }
  | {
    action: "object-removed";
    layerName: string;
    metadata: {
      objectId: string;
    };
  }
  | {
    action: "object-updated";
    layerName: string;
    metadata: {
      objectId: string;
      patch: Partial<VoxelObjectJSON>;
    };
  };

export type VoxelLayerHookAction = VoxelLayerHookEvent["action"];

export type VoxelLayerHookListener = (
  event: VoxelLayerHookEvent
) => void;
