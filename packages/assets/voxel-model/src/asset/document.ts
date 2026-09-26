// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type {
  BlockNodeJSON,
  VoxelModelSnapshot
} from "../network/types.ts";
import { createBlockTransform } from "../model/blockTransform.ts";
import { createBlockUv } from "../model/blockUv.ts";
import { InvalidVoxelModelDocumentError } from "./InvalidVoxelModelDocumentError.ts";

// CONSTANTS
export const VOXEL_MODEL_DOCUMENT_VERSION = 2;
const kDefaultBlockName = "Block";

export interface VoxelModelDocument extends VoxelModelSnapshot {
  version: typeof VOXEL_MODEL_DOCUMENT_VERSION;
  texture: AssetReferenceData;
}

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
    nodes: [...blocks].map(createBlockNode),
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

export function decodeVoxelModelDocument(
  content: Uint8Array
): VoxelModelDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(content));
  }
  catch (error) {
    throw new InvalidVoxelModelDocumentError("content is not JSON", { cause: error });
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new InvalidVoxelModelDocumentError("expected an object");
  }

  const document = parsed as Partial<VoxelModelDocument>;
  if (document.version !== VOXEL_MODEL_DOCUMENT_VERSION) {
    throw new InvalidVoxelModelDocumentError(
      `unsupported version ${String(document.version)}`
    );
  }
  if (!Array.isArray(document.nodes)) {
    throw new InvalidVoxelModelDocumentError("nodes must be an array");
  }
  if (!isReference(document.texture)) {
    throw new InvalidVoxelModelDocumentError("texture must be an asset reference");
  }

  return document as VoxelModelDocument;
}

function createBlockNode(
  name: string
): BlockNodeJSON {
  return {
    kind: "block",
    id: crypto.randomUUID(),
    parentId: null,
    name,
    transform: createBlockTransform(),
    uv: createBlockUv()
  };
}

function isReference(
  value: unknown
): value is AssetReferenceData {
  return typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "kind" in value &&
    typeof value.id === "string" &&
    typeof value.kind === "string";
}
