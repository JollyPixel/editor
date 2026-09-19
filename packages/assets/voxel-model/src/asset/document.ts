// Import Third-party Dependencies
import type { AssetReferenceData } from "@jolly-pixel/asset";

// Import Internal Dependencies
import type {
  ModelNodeJSON,
  Vector3JSON,
  VoxelModelSnapshot
} from "../network/types.ts";
import { InvalidVoxelModelDocumentError } from "./InvalidVoxelModelDocumentError.ts";

// CONSTANTS
export const VOXEL_MODEL_DOCUMENT_VERSION = 1;
const kDefaultBlockName = "Block";
const kZeroVector: Vector3JSON = { x: 0, y: 0, z: 0 };
const kUnitVector: Vector3JSON = { x: 1, y: 1, z: 1 };

export interface VoxelModelDocument extends VoxelModelSnapshot {
  version: typeof VOXEL_MODEL_DOCUMENT_VERSION;
  texture?: AssetReferenceData;
}

export interface VoxelModelDocumentOptions {
  texture?: AssetReferenceData;
  blocks?: Iterable<string>;
}

export function createVoxelModelDocument(
  options: VoxelModelDocumentOptions = {}
): VoxelModelDocument {
  const { blocks = [kDefaultBlockName] } = options;
  const document: VoxelModelDocument = {
    version: VOXEL_MODEL_DOCUMENT_VERSION,
    nodes: [...blocks].map(createBlockNode),
    folders: [],
    placements: []
  };
  if (options.texture !== undefined) {
    document.texture = {
      id: options.texture.id,
      kind: options.texture.kind
    };
  }

  return document;
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
  if (
    !Array.isArray(document.nodes) ||
    !Array.isArray(document.folders) ||
    !Array.isArray(document.placements)
  ) {
    throw new InvalidVoxelModelDocumentError(
      "nodes, folders and placements must be arrays"
    );
  }
  if (document.texture !== undefined && !isReference(document.texture)) {
    throw new InvalidVoxelModelDocumentError("texture must be an asset reference");
  }

  return document as VoxelModelDocument;
}

function createBlockNode(
  name: string
): ModelNodeJSON {
  return {
    uuid: crypto.randomUUID(),
    name,
    parentUuid: null,
    position: { ...kZeroVector },
    pivotOffset: { ...kZeroVector },
    size: { ...kUnitVector },
    scale: { ...kUnitVector },
    rotation: { ...kZeroVector }
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
