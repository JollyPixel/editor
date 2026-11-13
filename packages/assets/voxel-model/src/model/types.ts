// Import Third-party Dependencies
import type * as network from "@jolly-pixel/network";
import type { UVLayoutData } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type {
  animationBindingSchema,
  animationSetLinkSchema,
  blockNodeSchema,
  blockShapeSchema,
  blockTransformSchema,
  folderNodeSchema,
  materialFolderSchema,
  mirrorAxesSchema,
  modelMaterialSchema,
  nodeTransformSchema,
  vector3Schema,
  voxelModelSnapshotSchema
} from "./VoxelModel.schema.ts";
import type {
  voxelModelCommandSchema
} from "../network/VoxelModelCommand.schema.ts";
import type {
  materialSurfacePatchSchema,
  materialSurfaceSchema
} from "./materials/MaterialSurface.ts";

export type Vector3JSON = network.Infer<typeof vector3Schema>;
export type MirrorAxes = network.Infer<typeof mirrorAxesSchema>;
export type BlockTransformJSON = network.Infer<typeof blockTransformSchema>;
export type BlockShapeJSON = network.Infer<typeof blockShapeSchema>;
export type BlockShapeType = BlockShapeJSON["type"];
export type NodeTransformJSON = network.Infer<typeof nodeTransformSchema>;
export type MaterialSurfaceJSON = network.Infer<typeof materialSurfaceSchema>;
export type MaterialSurfacePatchJSON = network.Infer<typeof materialSurfacePatchSchema>;
export type ModelMaterialJSON = network.Infer<typeof modelMaterialSchema>;
export type MaterialFolderJSON = network.Infer<typeof materialFolderSchema>;
export type MaterialEntryJSON = MaterialFolderJSON | ModelMaterialJSON;
export type MaterialEntryKind = MaterialEntryJSON["kind"];

export type { UVLayoutData };

export type FolderNodeJSON = network.Infer<typeof folderNodeSchema>;
export type BlockNodeJSON = network.Infer<typeof blockNodeSchema>;
export type ModelNodeJSON = FolderNodeJSON | BlockNodeJSON;
export type ModelNodeKind = ModelNodeJSON["kind"];

export type AnimationBindingJSON = network.Infer<typeof animationBindingSchema>;
export type AnimationSetLinkJSON = network.Infer<typeof animationSetLinkSchema>;

export type VoxelModelCommand = network.Infer<typeof voxelModelCommandSchema>;
export type VoxelModelCommandAction = VoxelModelCommand["action"];
export type VoxelModelSnapshot = network.Infer<typeof voxelModelSnapshotSchema>;
