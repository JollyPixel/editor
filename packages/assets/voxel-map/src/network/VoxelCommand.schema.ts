// Import Third-party Dependencies
import {
  MessageProtocol,
  type JSONSchema
} from "@jolly-pixel/network";
import {
  MAX_TILESET_SLOT,
  VOXEL_WORLD_VERSION,
  type VoxelLayerCommandAction,
  type VoxelTemplateCommandAction,
  type VoxelTilesetCommandAction
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  networkCommand,
  objectSchema,
  tileSizeSchema
} from "./schema.ts";

// CONSTANTS
const kVector3Schema: JSONSchema = {
  type: "object",
  properties: {
    x: { type: "number" },
    y: { type: "number" },
    z: { type: "number" }
  },
  required: [
    "x",
    "y",
    "z"
  ]
};

const kVoxelTransformProperties = {
  rotation: { type: "number" },
  flipX: { type: "boolean" },
  flipY: { type: "boolean" },
  flipZ: { type: "boolean" }
} as const;

const kVoxelSetProperties = {
  position: kVector3Schema,
  blockId: { type: "number" },
  ...kVoxelTransformProperties,
  merge: { type: "boolean" }
} as const;

const kPatchCellsSchema: JSONSchema = {
  type: "array",
  items: { type: "integer" }
};

const kVoxelObjectProperties: Record<string, JSONSchema> = {
  id: { type: "string" },
  name: { type: "string" },
  type: { type: "string" },
  x: { type: "number" },
  y: { type: "number" },
  z: { type: "number" },
  width: { type: "number" },
  height: { type: "number" },
  rotation: { type: "number" },
  visible: { type: "boolean" },
  color: { type: "string" },
  locked: { type: "boolean" },
  properties: {
    type: "object",
    additionalProperties: {
      type: ["string", "number", "boolean"]
    }
  }
};

const kEmptySchema: JSONSchema = {
  type: "object"
};

const kIdSchema: JSONSchema = {
  type: "string",
  minLength: 1
};

const kRankSchema: JSONSchema = {
  type: "string",
  pattern: "^[0-9A-Za-z]*[1-9A-Za-z]$"
};

const kLayerMetadataSchemas: Record<VoxelLayerCommandAction, JSONSchema> = {
  added: objectSchema({
    name: { type: "string" },
    rank: kRankSchema,
    options: { type: "object" }
  }),
  removed: kEmptySchema,
  updated: objectSchema({
    options: { type: "object" }
  }),
  cloned: objectSchema({
    cloneId: kIdSchema,
    rank: kRankSchema,
    options: objectSchema({ name: { type: "string" } })
  }),
  merged: objectSchema({
    targetLayerId: kIdSchema
  }),
  "position-updated": {
    oneOf: [
      objectSchema({ position: kVector3Schema }),
      objectSchema({ delta: kVector3Schema })
    ]
  },
  "position-rebased": objectSchema({
    position: kVector3Schema
  }),
  "voxel-set": objectSchema(kVoxelSetProperties, [
    "position",
    "blockId",
    ...Object.keys(kVoxelTransformProperties)
  ]),
  "voxel-removed": objectSchema({
    position: kVector3Schema
  }),
  "voxels-set": objectSchema({
    entries: {
      type: "array",
      items: objectSchema(kVoxelSetProperties, ["position", "blockId"])
    }
  }),
  "voxels-removed": objectSchema({
    entries: {
      type: "array",
      items: objectSchema({ position: kVector3Schema })
    }
  }),
  "voxels-patched": objectSchema({
    cells: kPatchCellsSchema,
    partners: kPatchCellsSchema
  }, ["cells"]),
  "layer-transformed": objectSchema(kVoxelTransformProperties),
  "layer-moved": objectSchema({
    rank: kRankSchema
  }),
  "object-layer-added": kEmptySchema,
  "object-layer-removed": kEmptySchema,
  "object-layer-updated": objectSchema({
    patch: objectSchema({ visible: { type: "boolean" } }, [])
  }),
  "object-added": objectSchema({
    object: objectSchema(kVoxelObjectProperties, [
      "id",
      "name",
      "x",
      "y",
      "z",
      "visible"
    ])
  }),
  "object-removed": objectSchema({
    objectId: { type: "string" }
  }),
  "object-moved": objectSchema({
    objectId: { type: "string" },
    fromLayerName: { type: "string" },
    toLayerName: { type: "string" }
  }),
  "object-updated": objectSchema({
    objectId: { type: "string" },
    patch: objectSchema(kVoxelObjectProperties, [])
  })
};

const kTemplateSchema: JSONSchema = objectSchema(
  {
    id: { type: "string", minLength: 1 },
    name: { type: "string" },
    pivot: kVector3Schema,
    properties: { type: "object" },
    chunkSize: { type: "integer", minimum: 1 },
    palette: { type: "array" },
    chunks: { type: "array" }
  },
  ["id", "name", "pivot", "chunkSize", "palette", "chunks"]
);

const kTemplateCommandProperties: Record<
  VoxelTemplateCommandAction,
  Record<string, JSONSchema>
> = {
  "template-defined": {
    template: kTemplateSchema
  },
  "template-updated": {
    templateId: { type: "string" },
    patch: objectSchema({
      name: { type: "string" },
      pivot: kVector3Schema,
      properties: { type: "object" }
    }, [])
  },
  "template-removed": {
    templateId: { type: "string" }
  }
};

const kSlotSchema: JSONSchema = {
  type: "integer",
  minimum: 0,
  maximum: MAX_TILESET_SLOT
};

export const tilesetDefinitionSchema: JSONSchema = {
  ...objectSchema(
    {
      id: { type: "string", minLength: 1 },
      slot: kSlotSchema,
      src: { type: "string", minLength: 1 },
      asset: objectSchema({
        id: { type: "string", minLength: 1 },
        kind: { type: "string", minLength: 1 }
      }),
      tileSize: tileSizeSchema,
      cols: { type: "integer", minimum: 1 },
      rows: { type: "integer", minimum: 1 }
    },
    ["id"]
  ),
  anyOf: [
    { required: ["src", "tileSize"] },
    { required: ["asset"] }
  ]
};

const kTilesetCommandProperties: Record<
  VoxelTilesetCommandAction,
  Record<string, JSONSchema>
> = {
  "tileset-added": {
    tileset: tilesetDefinitionSchema
  },
  "tileset-removed": {
    tilesetId: { type: "string" }
  }
};

export const voxelWorldSchema: JSONSchema = {
  type: "object",
  properties: {
    version: { const: VOXEL_WORLD_VERSION },
    chunkSize: { type: "integer", minimum: 1 },
    tilesets: {
      type: "array",
      items: tilesetDefinitionSchema
    },
    layers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          palette: { type: "array" },
          chunks: { type: "array" }
        },
        required: ["palette", "chunks"]
      }
    },
    objectLayers: { type: "array" },
    templates: {
      type: "array",
      items: kTemplateSchema
    }
  },
  required: [
    "version",
    "chunkSize",
    "tilesets",
    "layers"
  ]
};

export const voxelCommandProtocol: MessageProtocol = new MessageProtocol({
  oneOf: [
    ...Object.entries(kLayerMetadataSchemas).map(
      ([action, metadata]) => networkCommand(action, action.startsWith("object-") ?
        { layerName: { type: "string" }, metadata } :
        { layerId: kIdSchema, metadata })
    ),
    ...Object.entries(kTemplateCommandProperties).map(
      ([action, properties]) => networkCommand(action, properties)
    ),
    ...Object.entries(kTilesetCommandProperties).map(
      ([action, properties]) => networkCommand(action, properties)
    ),
    networkCommand("world-replace", {
      data: voxelWorldSchema
    })
  ]
});
