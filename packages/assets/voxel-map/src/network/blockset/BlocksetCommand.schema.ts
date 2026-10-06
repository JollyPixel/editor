// Import Third-party Dependencies
import {
  defineSchema,
  MessageProtocol,
  type JSONSchema
} from "@jolly-pixel/network";
import {
  pixelCommandSchemas,
  pixelSnapshotSchema
} from "@jolly-pixel/asset.pixel-art/server";
import {
  MAX_LOCAL_BLOCK_ID,
  type BlocksetMaterialGroupRenameCommand,
  type BlocksetTileSizeCommand,
  type VoxelBlendGroupCommandAction,
  type VoxelBlockCommandAction,
  type VoxelMaterialGroupCommandAction
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  networkCommand,
  objectSchema,
  tileSizeSchema
} from "../schema.ts";

// CONSTANTS
const kUnitSchema = defineSchema({
  type: "number",
  minimum: 0,
  maximum: 1
});

const kBlockCommandProperties: Record<
  VoxelBlockCommandAction,
  Record<string, JSONSchema>
> = {
  "block-defined": {
    block: objectSchema({
      id: {
        type: "integer",
        minimum: 1,
        maximum: MAX_LOCAL_BLOCK_ID
      },
      name: { type: "string" },
      shapeId: { type: "string" }
    })
  },
  "block-removed": {
    blockId: { type: "integer" }
  },
  "block-moved": {
    blockId: { type: "integer" },
    toIndex: { type: "integer" }
  }
};

export const materialGroupSchema = defineSchema({
  type: "object",
  properties: {
    id: { type: "string", minLength: 1 },
    roughness: kUnitSchema,
    metalness: kUnitSchema,
    emissive: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
    emissiveIntensity: { type: "number", minimum: 0 },
    normalScale: { type: "number", minimum: 0 },
    swatch: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" }
  },
  required: ["id"]
});

const kMaterialGroupCommandProperties: Record<
  VoxelMaterialGroupCommandAction,
  Record<string, JSONSchema>
> = {
  "material-group-defined": {
    group: materialGroupSchema
  },
  "material-group-removed": {
    groupId: { type: "string", minLength: 1 }
  }
};

export const blendGroupSchema = defineSchema({
  type: "object",
  properties: {
    id: { type: "string", minLength: 1 },
    width: { type: "integer", minimum: 1, maximum: 64 },
    pattern: { type: "string", enum: ["noise", "bayer"] },
    priority: { type: "integer" },
    exclude: {
      type: "array",
      items: { type: "string", minLength: 1 }
    }
  },
  required: ["id"]
});

const kBlendGroupCommandProperties: Record<
  VoxelBlendGroupCommandAction,
  Record<string, JSONSchema>
> = {
  "blend-group-defined": {
    group: blendGroupSchema
  },
  "blend-group-removed": {
    groupId: { type: "string", minLength: 1 }
  }
};

const kTileSizeAction: BlocksetTileSizeCommand["action"] = "tile-size-updated";
const kMaterialGroupRenameAction: BlocksetMaterialGroupRenameCommand["action"] =
  "material-group-renamed";

export const blocksetSnapshotSchema: JSONSchema = {
  type: "object",
  properties: {
    tileSize: tileSizeSchema,
    pixels: pixelSnapshotSchema,
    blocks: { type: "array" },
    materialGroups: {
      type: "array",
      items: materialGroupSchema
    },
    blendGroups: {
      type: "array",
      items: blendGroupSchema
    }
  },
  required: [
    "tileSize",
    "pixels",
    "blocks",
    "materialGroups"
  ]
};

export const blocksetCommandProtocol: MessageProtocol = new MessageProtocol({
  oneOf: [
    ...pixelCommandSchemas,
    ...Object.entries(kBlockCommandProperties).map(
      ([action, properties]) => networkCommand(action, properties)
    ),
    ...Object.entries(kMaterialGroupCommandProperties).map(
      ([action, properties]) => networkCommand(action, properties)
    ),
    ...Object.entries(kBlendGroupCommandProperties).map(
      ([action, properties]) => networkCommand(action, properties)
    ),
    networkCommand(kTileSizeAction, {
      tileSize: tileSizeSchema
    }),
    networkCommand(kMaterialGroupRenameAction, {
      groupId: { type: "string", minLength: 1 },
      to: { type: "string", minLength: 1 }
    })
  ]
});
