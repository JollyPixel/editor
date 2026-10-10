// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import {
  defineSchema,
  type Infer
} from "@jolly-pixel/network";
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import { BlockTransform } from "../model/nodes/BlockTransform.ts";
import { BlockUvLayouts } from "../model/nodes/BlockUvLayouts.ts";
import { randomId } from "../model/randomId.ts";
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
export const VOXEL_MODEL_DOCUMENT_VERSION = 2;
const kDefaultBlockName = "Block";

export const VOXEL_MODEL_ASSET: AssetKindDescriptor = {
  kind: VOXEL_MODEL_KIND,
  label: "Voxel model",
  extension: VOXEL_MODEL_EXTENSION,
  icon: VOXEL_MODEL_ICON
};

const kStoredBlockNodeSchema = defineSchema({
  ...blockNodeSchema,
  properties: {
    ...blockNodeSchema.properties,
    transform: {
      type: "object",
      properties: blockTransformSchema.properties
    }
  }
});

export const voxelModelDocumentSchema = defineSchema({
  type: "object",
  properties: {
    version: { const: VOXEL_MODEL_DOCUMENT_VERSION },
    nodes: {
      type: "array",
      items: {
        oneOf: [folderNodeSchema, kStoredBlockNodeSchema]
      }
    },
    materials: voxelModelSnapshotSchema.properties.materials,
    animationSets: voxelModelSnapshotSchema.properties.animationSets,
    texture: {
      type: "object",
      properties: {
        id: { type: "string" },
        kind: { type: "string" }
      },
      required: ["id", "kind"]
    }
  },
  required: ["version", "nodes", "materials", "animationSets", "texture"]
});

type StoredVoxelModelDocument = Infer<typeof voxelModelDocumentSchema>;
type StoredModelNode = StoredVoxelModelDocument["nodes"][number];

export type VoxelModelDocument = VoxelModelSnapshot & {
  version: typeof VOXEL_MODEL_DOCUMENT_VERSION;
  texture: AssetReferenceData;
};

export interface VoxelModelDocumentOptions {
  texture: AssetReferenceData;
  blocks?: Iterable<string>;
}

export function createVoxelModelDocument(
  options: VoxelModelDocumentOptions
): VoxelModelDocument {
  const {
    texture,
    blocks = [kDefaultBlockName]
  } = options;

  return {
    version: VOXEL_MODEL_DOCUMENT_VERSION,
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

export function encodeVoxelModelDocument(
  document: VoxelModelDocument
): Uint8Array {
  const stored: StoredVoxelModelDocument = {
    ...document,
    nodes: document.nodes.map(compactNode)
  };

  return new TextEncoder().encode(JSON.stringify(stored));
}

function compactNode(
  node: ModelNodeJSON
): StoredModelNode {
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
