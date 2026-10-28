// Import Third-party Dependencies
import {
  MessageProtocol,
  requireAnyGroup
} from "@jolly-pixel/network";
import {
  MAX_BLOCKSET_SLOT,
  VOXEL_WORLD_VERSION,
  type VoxelLayerCommandAction,
  type VoxelTemplateCommandAction,
  type VoxelBlocksetCommandAction
} from "@jolly-pixel/voxel.renderer";
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  anyObjectSchema,
  networkCommand,
  tileSizeSchema
} from "./schema.ts";

// CONSTANTS
const kVector3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number()
});

const kVoxelTransformSchema = z.object({
  rotation: z.number(),
  flipX: z.boolean(),
  flipY: z.boolean(),
  flipZ: z.boolean()
});

const kVoxelPlacementShape = {
  position: kVector3Schema,
  blockId: z.number(),
  merge: z.optional(z.boolean())
};

const kPatchCellsSchema = z.array(z.int());

const kVoxelObjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.number(),
  visible: z.boolean(),
  color: z.string(),
  locked: z.boolean(),
  anchor: z.boolean(),
  properties: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean()])
  )
});

const kIdSchema = z.string().check(z.minLength(1));
const kPositiveInteger = z.int().check(z.minimum(1));

const kRankSchema = z.string().check(
  z.regex(/^[0-9A-Za-z]*[1-9A-Za-z]$/)
);

const kLayerMetadataSchemas: Record<VoxelLayerCommandAction, z.ZodMiniType> = {
  added: z.object({
    name: z.string(),
    rank: kRankSchema,
    options: anyObjectSchema
  }),
  removed: anyObjectSchema,
  updated: z.object({
    options: anyObjectSchema
  }),
  cloned: z.object({
    cloneId: kIdSchema,
    rank: kRankSchema,
    options: z.object({ name: z.string() })
  }),
  merged: z.object({
    targetLayerId: kIdSchema
  }),
  "position-updated": z.union([
    z.object({ position: kVector3Schema }),
    z.object({ delta: kVector3Schema })
  ]),
  "position-rebased": z.object({
    position: kVector3Schema
  }),
  "voxel-set": z.extend(kVoxelTransformSchema, kVoxelPlacementShape),
  "voxel-removed": z.object({
    position: kVector3Schema
  }),
  "voxels-set": z.object({
    entries: z.array(
      z.extend(z.partial(kVoxelTransformSchema), kVoxelPlacementShape)
    )
  }),
  "voxels-removed": z.object({
    entries: z.array(z.object({ position: kVector3Schema }))
  }),
  "voxels-patched": z.object({
    cells: kPatchCellsSchema,
    partners: z.optional(kPatchCellsSchema)
  }),
  "layer-transformed": kVoxelTransformSchema,
  "layer-moved": z.object({
    rank: kRankSchema
  }),
  "object-layer-added": anyObjectSchema,
  "object-layer-removed": anyObjectSchema,
  "object-layer-updated": z.object({
    patch: z.object({ visible: z.optional(z.boolean()) })
  }),
  "object-added": z.object({
    object: z.partial(kVoxelObjectSchema, {
      type: true,
      width: true,
      height: true,
      rotation: true,
      color: true,
      locked: true,
      anchor: true,
      properties: true
    })
  }),
  "object-removed": z.object({
    objectId: z.string()
  }),
  "object-moved": z.object({
    objectId: z.string(),
    fromLayerName: z.string(),
    toLayerName: z.string()
  }),
  "object-updated": z.object({
    objectId: z.string(),
    patch: z.partial(kVoxelObjectSchema)
  })
};

const kTemplateSchema = z.object({
  id: kIdSchema,
  name: z.string(),
  pivot: kVector3Schema,
  properties: z.optional(anyObjectSchema),
  chunkSize: kPositiveInteger,
  palette: z.array(z.unknown()),
  chunks: z.array(z.unknown())
});

const kTemplateCommandProperties: Record<
  VoxelTemplateCommandAction,
  z.core.$ZodLooseShape
> = {
  "template-defined": {
    template: kTemplateSchema
  },
  "template-updated": {
    templateId: z.string(),
    patch: z.partial(z.object({
      name: z.string(),
      pivot: kVector3Schema,
      properties: anyObjectSchema
    }))
  },
  "template-removed": {
    templateId: z.string()
  }
};

const kSlotSchema = z.int().check(z.minimum(0), z.maximum(MAX_BLOCKSET_SLOT));

export const blocksetDefinitionSchema = requireAnyGroup(
  z.object({
    id: kIdSchema,
    slot: z.optional(kSlotSchema),
    src: z.optional(kIdSchema),
    asset: z.optional(z.object({
      id: kIdSchema,
      kind: kIdSchema
    })),
    tileSize: z.optional(tileSizeSchema),
    cols: z.optional(kPositiveInteger),
    rows: z.optional(kPositiveInteger)
  }),
  [["src", "tileSize"], ["asset"]]
);

const kBlocksetCommandProperties: Record<
  VoxelBlocksetCommandAction,
  z.core.$ZodLooseShape
> = {
  "blockset-added": {
    blockset: blocksetDefinitionSchema
  },
  "blockset-removed": {
    blocksetId: z.string()
  }
};

export const voxelWorldSchema = z.object({
  version: z.literal(VOXEL_WORLD_VERSION),
  chunkSize: kPositiveInteger,
  blocksets: z.array(blocksetDefinitionSchema),
  layers: z.array(z.object({
    palette: z.array(z.unknown()),
    chunks: z.array(z.unknown())
  })),
  objectLayers: z.optional(z.array(z.unknown())),
  templates: z.optional(z.array(kTemplateSchema))
});

export const voxelCommandProtocol: MessageProtocol = new MessageProtocol(z.union([
  ...Object.entries(kLayerMetadataSchemas).map(
    ([action, metadata]) => networkCommand(action, action.startsWith("object-") ?
      { layerName: z.string(), metadata } :
      { layerId: kIdSchema, metadata })
  ),
  ...Object.entries(kTemplateCommandProperties).map(
    ([action, properties]) => networkCommand(action, properties)
  ),
  ...Object.entries(kBlocksetCommandProperties).map(
    ([action, properties]) => networkCommand(action, properties)
  ),
  networkCommand("world-replace", {
    data: voxelWorldSchema
  })
]));
