// Import Third-party Dependencies
import type { Vector3Like } from "three";

// Import Internal Dependencies
import type {
  VoxelLayerCloneOptions,
  VoxelLayerConfigurableOptions,
  VoxelLayerUpdate
} from "../world/VoxelLayer.ts";
import type {
  VoxelSetOptions,
  VoxelRemoveOptions
} from "../world/VoxelWorld.ts";
import type { VoxelCoord } from "../world/types.ts";
import type { VoxelPatch } from "../world/editing/voxelPatch.ts";
import type {
  ResolvedBlockDefinition
} from "../blocks/BlockDefinition.ts";
import type { BlockRedefinition } from "../blocks/BlockRedefinition.ts";
import type { BlocksetDefinition } from "../blocksets/types.ts";
import type { MaterialGroupJSON } from "../materials/MaterialGroup.ts";
import type { BlendGroupJSON } from "../materials/BlendGroup.ts";
import type {
  VoxelObjectLayerJSON,
  VoxelObjectJSON
} from "../world/objects/types.ts";
import type { VoxelTemplatePatch } from "../world/templates/types.ts";
import type { VoxelTemplateJSON } from "../serialization/types.ts";

export type VoxelLayerStructureCommand =
  | {
    action: "added";
    layerId: string;
    metadata: {
      name: string;
      rank: string;
      options: VoxelLayerConfigurableOptions;
    };
  }
  | {
    action: "removed";
    layerId: string;
    metadata: Record<string, never>;
  }
  | {
    action: "updated";
    layerId: string;
    metadata: {
      options: VoxelLayerUpdate;
    };
  }
  | {
    action: "cloned";
    layerId: string;
    metadata: {
      cloneId: string;
      rank: string;
      options: VoxelLayerCloneOptions;
    };
  }
  | {
    action: "merged";
    layerId: string;
    metadata: {
      targetLayerId: string;
    };
  }
  | {
    action: "position-updated";
    layerId: string;
    metadata: { position: VoxelCoord; } | { delta: VoxelCoord; };
  }
  | {
    action: "position-rebased";
    layerId: string;
    metadata: { position: VoxelCoord; };
  }
  | {
    action: "layer-moved";
    layerId: string;
    metadata: {
      rank: string;
    };
  };

export type VoxelEditCommand =
  | {
    action: "voxel-set";
    layerId: string;
    metadata: {
      position: Vector3Like;
      blockId: number;
      rotation: number;
      flipX: boolean;
      flipZ: boolean;
      flipY: boolean;
      merge?: boolean;
    };
  }
  | {
    action: "voxel-removed";
    layerId: string;
    metadata: {
      position: Vector3Like;
    };
  }
  | {
    action: "voxels-set";
    layerId: string;
    metadata: {
      entries: VoxelSetOptions[];
    };
  }
  | {
    action: "voxels-removed";
    layerId: string;
    metadata: {
      entries: VoxelRemoveOptions[];
    };
  }
  | {
    action: "voxels-patched";
    layerId: string;
    metadata: VoxelPatch;
  }
  | {
    action: "layer-transformed";
    layerId: string;
    metadata: {
      rotation: number;
      flipX: boolean;
      flipZ: boolean;
      flipY: boolean;
    };
  };

export type VoxelObjectLayerCommand =
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
    action: "object-moved";
    layerName: string;
    metadata: {
      objectId: string;
      fromLayerName: string;
      toLayerName: string;
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

export type VoxelLayerCommand =
  | VoxelLayerStructureCommand
  | VoxelEditCommand
  | VoxelObjectLayerCommand;

export type VoxelLayerCommandAction = VoxelLayerCommand["action"];

export type VoxelTemplateCommand =
  | {
    action: "template-defined";
    template: VoxelTemplateJSON;
  }
  | {
    action: "template-updated";
    templateId: string;
    patch: VoxelTemplatePatch;
  }
  | {
    action: "template-removed";
    templateId: string;
  };

export type VoxelTemplateCommandAction = VoxelTemplateCommand["action"];

export type VoxelBlockCommand =
  | {
    action: "block-defined";
    block: ResolvedBlockDefinition;
  }
  | {
    action: "block-removed";
    blockId: number;
  }
  | {
    action: "block-moved";
    blockId: number;
    toIndex: number;
  };

export type VoxelBlockCommandAction = VoxelBlockCommand["action"];

export type VoxelBlocksetCommand =
  | {
    action: "blockset-added";
    blockset: BlocksetDefinition;
  }
  | {
    action: "blockset-removed";
    blocksetId: string;
  };

export type VoxelBlocksetCommandAction = VoxelBlocksetCommand["action"];

export type VoxelMaterialGroupCommand =
  | {
    action: "material-group-defined";
    group: MaterialGroupJSON;
  }
  | {
    action: "material-group-removed";
    groupId: string;
  };

export type VoxelMaterialGroupCommandAction =
  VoxelMaterialGroupCommand["action"];

export type VoxelBlendGroupCommand =
  | {
    action: "blend-group-defined";
    group: BlendGroupJSON;
  }
  | {
    action: "blend-group-removed";
    groupId: string;
  };

export type VoxelBlendGroupCommandAction = VoxelBlendGroupCommand["action"];

export type VoxelCommand =
  | VoxelLayerCommand
  | VoxelTemplateCommand
  | VoxelBlockCommand
  | VoxelBlocksetCommand
  | VoxelMaterialGroupCommand
  | VoxelBlendGroupCommand;

export type VoxelCommandAction = VoxelCommand["action"];

/**
 * Commands a `VoxelWorld` applies and emits: its layers and templates.
 */
export type VoxelWorldContentCommand =
  | VoxelLayerCommand
  | VoxelTemplateCommand;

/**
 * Commands a world persists and shares: its content and its blockset links.
 * Blocks, material groups and blend groups belong to the blocksets.
 */
export type VoxelWorldCommand =
  | VoxelWorldContentCommand
  | VoxelBlocksetCommand;

export type VoxelWorldCommandAction = VoxelWorldCommand["action"];

export type BlocksetTileSizeCommand = {
  action: "tile-size-updated";
  tileSize: number;
};

/**
 * Commands a blockset document applies to its own blocks, material groups,
 * blend groups and tile size.
 */
export type BlocksetDocumentCommand =
  | VoxelBlockCommand
  | VoxelMaterialGroupCommand
  | VoxelBlendGroupCommand
  | BlocksetTileSizeCommand;

export type BlocksetDocumentCommandAction = BlocksetDocumentCommand["action"];

export type VoxelCommandOrigin = "local" | "remote";

export interface VoxelCommandContext {
  /**
   * `"local"` for a change made on this engine, `"remote"` for a command
   * replayed with `apply()` on behalf of another peer.
   */
  origin: VoxelCommandOrigin;
  /**
   * What a `"block-defined"` command changed compared with the definition it
   * replaced. Set by `apply()` and absent on every other command.
   */
  redefinition?: BlockRedefinition;
}

export type VoxelCommandListener = (
  command: VoxelCommand,
  context: VoxelCommandContext
) => void;
