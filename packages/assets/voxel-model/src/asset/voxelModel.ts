// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import type { Infer } from "@jolly-pixel/network";
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";
import { randomId } from "@jolly-pixel/asset.common";
import * as z from "zod/mini";

// Import Internal Dependencies
import { BlockTransform } from "../model/nodes/BlockTransform.ts";
import { BlockUvLayouts } from "../model/nodes/BlockUvLayouts.ts";
import {
  blockNodeSchema,
  blockTransformSchema,
  folderNodeSchema,
  voxelModelSnapshotSchema
} from "../network/VoxelModelCommand.schema.ts";
import type {
  ModelNodeJSON,
  UVLayoutData,
  VoxelModelSnapshot
} from "../network/types.ts";
import { VOXEL_MODEL_ICON } from "./icons.ts";

// CONSTANTS
export const VOXEL_MODEL_KIND = "voxelmodel";
export const VOXEL_MODEL_COMMAND = "voxelmodel.command";
export const VOXEL_MODEL_EXTENSION = ".voxelmodel.json";
export const VOXEL_MODEL_FILE_VERSION = 2;
const kDefaultBlockName = "Block";

export const VOXEL_MODEL_ASSET: AssetKindDescriptor = {
  kind: VOXEL_MODEL_KIND,
  label: "Voxel model",
  extension: VOXEL_MODEL_EXTENSION,
  icon: VOXEL_MODEL_ICON
};

const kCompactBlockNodeSchema = z.extend(blockNodeSchema, {
  transform: z.partial(blockTransformSchema)
});

export const compactVoxelModelFileSchema = z.object({
  version: z.literal(VOXEL_MODEL_FILE_VERSION),
  nodes: z.array(z.union([folderNodeSchema, kCompactBlockNodeSchema])),
  materials: voxelModelSnapshotSchema.shape.materials,
  animationSets: voxelModelSnapshotSchema.shape.animationSets,
  texture: z.object({
    id: z.string(),
    kind: z.string()
  })
});

export type CompactVoxelModelFile = Infer<typeof compactVoxelModelFileSchema>;
type CompactModelNode = CompactVoxelModelFile["nodes"][number];

export type VoxelModelFile = VoxelModelSnapshot & {
  version: typeof VOXEL_MODEL_FILE_VERSION;
  texture: AssetReferenceData;
};

export interface VoxelModelFileOptions {
  texture: AssetReferenceData;
  blocks?: Iterable<string>;
}

export function createVoxelModelFile(
  options: VoxelModelFileOptions
): VoxelModelFile {
  const {
    texture,
    blocks = [kDefaultBlockName]
  } = options;

  return {
    version: VOXEL_MODEL_FILE_VERSION,
    nodes: [...blocks].map((name) => {
      return {
        kind: "block",
        id: randomId(),
        parentId: null,
        name,
        transform: BlockTransform.create(),
        uv: BlockUvLayouts.net()
      };
    }),
    materials: [],
    animationSets: [],
    texture: {
      id: texture.id,
      kind: texture.kind
    }
  };
}

export function compactVoxelModelFile(
  file: VoxelModelFile
): CompactVoxelModelFile {
  return {
    ...file,
    nodes: file.nodes.map(compactNode)
  };
}

export function expandVoxelModelFile(
  compact: CompactVoxelModelFile
): VoxelModelFile {
  return {
    ...compact,
    nodes: compact.nodes.map(expandNode)
  };
}

function compactNode(
  node: ModelNodeJSON
): CompactModelNode {
  return node.kind === "folder" ?
    node :
    {
      ...node,
      transform: BlockTransform.compact(node.transform),
      uv: compactUv(node.uv)
    };
}

function compactUv(
  uv: UVLayoutData
): UVLayoutData {
  if (uv.state === "stacked" || uv.activeFaces === undefined) {
    return uv;
  }

  const { activeFaces, ...rest } = uv;
  const slots = Object.keys(uv.faces);

  return activeFaces.length === slots.length &&
    activeFaces.every((slot, index) => slot === slots[index]) ?
    rest :
    uv;
}

function expandNode(
  compact: CompactModelNode
): ModelNodeJSON {
  return compact.kind === "folder" ?
    compact :
    {
      ...compact,
      transform: BlockTransform.create(compact.transform),
      uv: expandUv(compact.uv)
    };
}

function expandUv(
  uv: UVLayoutData
): UVLayoutData {
  return uv.state === "stacked" || uv.activeFaces !== undefined ?
    uv :
    {
      ...uv,
      activeFaces: Object.keys(uv.faces)
    };
}
