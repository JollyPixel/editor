// Import Third-party Dependencies
import { MessageProtocol } from "@jolly-pixel/network";
import {
  pixelCommandSchemas,
  pixelSnapshotSchema
} from "@jolly-pixel/asset.pixel-art/server";
import {
  MAX_LIGHT_LEVEL,
  MAX_LOCAL_BLOCK_ID,
  type BlocksetMaterialGroupRenameCommand,
  type BlocksetTileSizeCommand,
  type VoxelBlendGroupCommandAction,
  type VoxelBlockCommandAction,
  type VoxelMaterialGroupCommandAction
} from "@jolly-pixel/voxel.renderer";
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  networkCommand,
  tileSizeSchema
} from "../schema.ts";

// CONSTANTS
const kUnitSchema = z.number().check(z.minimum(0), z.maximum(1));
const kNonEmptyString = z.string().check(z.minLength(1));
const kHexColorSchema = z.string().check(z.regex(/^#[0-9a-fA-F]{6}$/));

const kBlockCommandProperties: Record<
  VoxelBlockCommandAction,
  z.core.$ZodLooseShape
> = {
  "block-defined": {
    block: z.object({
      id: z.int().check(z.minimum(1), z.maximum(MAX_LOCAL_BLOCK_ID)),
      name: z.string(),
      shapeId: z.string()
    })
  },
  "block-removed": {
    blockId: z.int()
  },
  "block-moved": {
    blockId: z.int(),
    toIndex: z.int()
  }
};

export const materialGroupSchema = z.object({
  id: kNonEmptyString,
  roughness: z.optional(kUnitSchema),
  metalness: z.optional(kUnitSchema),
  emissive: z.optional(kHexColorSchema),
  emissiveIntensity: z.optional(z.number().check(z.minimum(0))),
  normalScale: z.optional(z.number().check(z.minimum(0))),
  lightLevel: z.optional(z.int().check(z.minimum(0), z.maximum(MAX_LIGHT_LEVEL))),
  swatch: z.optional(kHexColorSchema)
});

const kMaterialGroupCommandProperties: Record<
  VoxelMaterialGroupCommandAction,
  z.core.$ZodLooseShape
> = {
  "material-group-defined": {
    group: materialGroupSchema
  },
  "material-group-removed": {
    groupId: kNonEmptyString
  }
};

export const blendGroupSchema = z.object({
  id: kNonEmptyString,
  width: z.optional(z.int().check(z.minimum(1), z.maximum(64))),
  pattern: z.optional(z.enum(["noise", "bayer"])),
  priority: z.optional(z.int()),
  exclude: z.optional(z.array(kNonEmptyString))
});

const kBlendGroupCommandProperties: Record<
  VoxelBlendGroupCommandAction,
  z.core.$ZodLooseShape
> = {
  "blend-group-defined": {
    group: blendGroupSchema
  },
  "blend-group-removed": {
    groupId: kNonEmptyString
  }
};

const kTileSizeAction: BlocksetTileSizeCommand["action"] = "tile-size-updated";
const kMaterialGroupRenameAction: BlocksetMaterialGroupRenameCommand["action"] =
  "material-group-renamed";

export const blocksetSnapshotSchema = z.object({
  tileSize: tileSizeSchema,
  pixels: pixelSnapshotSchema,
  blocks: z.array(z.unknown()),
  materialGroups: z.array(materialGroupSchema),
  blendGroups: z.optional(z.array(blendGroupSchema))
});

export const blocksetCommandProtocol: MessageProtocol = new MessageProtocol(z.union([
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
    groupId: kNonEmptyString,
    to: kNonEmptyString
  })
]));
