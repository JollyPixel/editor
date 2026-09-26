// Import Third-party Dependencies
import {
  defineMessageProtocol,
  defineSchema,
  type JSONSchema,
  type MessageProtocol
} from "@jolly-pixel/network";
import {
  pixelCommandSchemas,
  pixelSnapshotSchema
} from "@jolly-pixel/asset.pixel-art/network/server.ts";
import {
  MAX_LOCAL_BLOCK_ID,
  type TilesetTileSizeCommand,
  type VoxelBlockCommandAction,
  type VoxelMaterialGroupCommandAction
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  commandVariant,
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
    emissiveIntensity: { type: "number", minimum: 0 }
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

const kTileSizeAction: TilesetTileSizeCommand["action"] = "tile-size-updated";

export const tilesetSnapshotSchema: JSONSchema = {
  type: "object",
  properties: {
    tileSize: tileSizeSchema,
    pixels: pixelSnapshotSchema,
    blocks: { type: "array" },
    materialGroups: {
      type: "array",
      items: materialGroupSchema
    }
  },
  required: [
    "tileSize",
    "pixels",
    "blocks",
    "materialGroups"
  ]
};

export const tilesetCommandProtocol: MessageProtocol = defineMessageProtocol({
  schema: {
    oneOf: [
      ...pixelCommandSchemas,
      ...Object.entries(kBlockCommandProperties).map(
        ([action, properties]) => commandVariant(action, properties)
      ),
      ...Object.entries(kMaterialGroupCommandProperties).map(
        ([action, properties]) => commandVariant(action, properties)
      ),
      commandVariant(kTileSizeAction, {
        tileSize: tileSizeSchema
      })
    ]
  }
});
