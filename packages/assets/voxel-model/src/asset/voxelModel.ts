// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";
import {
  defineSchema,
  type Infer
} from "@jolly-pixel/network";
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server/kinds";

// Import Internal Dependencies
import { createBlockTransform } from "../model/blockTransform.ts";
import { createBlockUv } from "../model/blockUv.ts";
import { voxelModelSnapshotSchema } from "../network/VoxelModelCommand.schema.ts";

// CONSTANTS
export const VOXEL_MODEL_KIND = "voxelmodel";
export const VOXEL_MODEL_COMMAND = "voxelmodel.command";
export const VOXEL_MODEL_EXTENSION = ".voxelmodel.json";
export const VOXEL_MODEL_DOCUMENT_VERSION = 2;
const kDefaultBlockName = "Block";

export const VOXEL_MODEL_ASSET: AssetKindDescriptor = {
  kind: VOXEL_MODEL_KIND,
  label: "Voxel model",
  icon: {
    svg: `
      <path
        d="M12 2 3 7v10l9 5 9-5V7l-9-5Z"
        fill="currentColor"
        opacity="0.35"
      />
      <path
        class="tone-ink"
        d="M3 7l9 5 9-5M12 12v10"
        stroke="currentColor"
        stroke-width="2"
        fill="none"
      />
    `,
    tone: "sky"
  }
};

export const voxelModelDocumentSchema = defineSchema({
  type: "object",
  properties: {
    version: { const: VOXEL_MODEL_DOCUMENT_VERSION },
    nodes: voxelModelSnapshotSchema.properties.nodes,
    texture: {
      type: "object",
      properties: {
        id: { type: "string" },
        kind: { type: "string" }
      },
      required: ["id", "kind"]
    }
  },
  required: ["version", "nodes", "texture"]
});

export type VoxelModelDocument = Infer<typeof voxelModelDocumentSchema>;

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
        id: crypto.randomUUID(),
        parentId: null,
        name,
        transform: createBlockTransform(),
        uv: createBlockUv()
      };
    }),
    texture: {
      id: texture.id,
      kind: texture.kind
    }
  };
}

export function encodeVoxelModelDocument(
  document: VoxelModelDocument
): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(document));
}
