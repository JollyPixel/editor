// Import Third-party Dependencies
import {
  COMMAND_HEADER_REQUIRED,
  commandHeaderProperties,
  defineMessageProtocol,
  type JSONSchema,
  type MessageProtocol
} from "@jolly-pixel/network";
import {
  MAX_TILE_SIZE,
  type VoxelBlockCommandAction,
  type VoxelLayerCommandAction,
  type VoxelMaterialGroupCommandAction,
  type VoxelTilesetCommandAction
} from "@jolly-pixel/voxel.renderer";

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

function objectSchema(
  properties: Record<string, JSONSchema>,
  required: readonly string[] = Object.keys(properties)
): JSONSchema {
  return {
    type: "object",
    properties,
    required: [...required]
  };
}

const kLayerMetadataSchemas: Record<VoxelLayerCommandAction, JSONSchema> = {
  added: objectSchema({
    options: { type: "object" }
  }),
  removed: kEmptySchema,
  updated: objectSchema({
    options: { type: "object" }
  }),
  cloned: objectSchema({
    options: objectSchema({ name: { type: "string" } })
  }),
  merged: objectSchema({
    targetLayerName: { type: "string" }
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
  "voxel-set": objectSchema({
    position: kVector3Schema,
    blockId: { type: "number" },
    ...kVoxelTransformProperties
  }),
  "voxel-removed": objectSchema({
    position: kVector3Schema
  }),
  "voxels-set": objectSchema({
    entries: {
      type: "array",
      items: objectSchema({
        position: kVector3Schema,
        blockId: { type: "number" },
        ...kVoxelTransformProperties
      }, ["position", "blockId"])
    }
  }),
  "voxels-removed": objectSchema({
    entries: {
      type: "array",
      items: objectSchema({ position: kVector3Schema })
    }
  }),
  "voxels-patched": objectSchema({
    cells: {
      type: "array",
      items: { type: "integer" }
    }
  }),
  reordered: objectSchema({
    direction: { enum: ["up", "down"] }
  }),
  "layer-moved": objectSchema({
    toIndex: { type: "integer" }
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

const kBlockCommandProperties: Record<
  VoxelBlockCommandAction,
  Record<string, JSONSchema>
> = {
  "block-defined": {
    block: objectSchema({ id: { type: "integer" } })
  },
  "block-removed": {
    blockId: { type: "integer" }
  },
  "block-moved": {
    blockId: { type: "integer" },
    toIndex: { type: "integer" }
  }
};

const kTileSizeSchema: JSONSchema = {
  type: "integer",
  minimum: 1,
  maximum: MAX_TILE_SIZE
};

const kTilesetCommandProperties: Record<
  VoxelTilesetCommandAction,
  Record<string, JSONSchema>
> = {
  "tileset-added": {
    tileset: {
      ...objectSchema(
        {
          id: { type: "string", minLength: 1 },
          src: { type: "string", minLength: 1 },
          asset: objectSchema({
            id: { type: "string", minLength: 1 },
            kind: { type: "string", minLength: 1 }
          }),
          tileSize: kTileSizeSchema
        },
        ["id", "tileSize"]
      ),
      anyOf: [
        { required: ["src"] },
        { required: ["asset"] }
      ]
    }
  },
  "tileset-removed": {
    tilesetId: { type: "string" }
  },
  "tileset-resized": {
    tilesetId: { type: "string" },
    tileSize: kTileSizeSchema
  },
  "default-tile-size-updated": {
    defaultTileSize: kTileSizeSchema
  }
};

const kUnitSchema: JSONSchema = {
  type: "number",
  minimum: 0,
  maximum: 1
};

const kMaterialGroupSchema = objectSchema(
  {
    id: { type: "string", minLength: 1 },
    roughness: kUnitSchema,
    metalness: kUnitSchema,
    emissive: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
    emissiveIntensity: { type: "number", minimum: 0 }
  },
  ["id"]
);

const kMaterialGroupCommandProperties: Record<
  VoxelMaterialGroupCommandAction,
  Record<string, JSONSchema>
> = {
  "material-group-defined": {
    group: kMaterialGroupSchema
  },
  "material-group-removed": {
    groupId: { type: "string", minLength: 1 }
  }
};

export const voxelWorldSchema: JSONSchema = {
  type: "object",
  properties: {
    version: { const: 1 },
    chunkSize: { type: "number" },
    tilesets: { type: "array" },
    defaultTileSize: { type: "number" },
    blocks: { type: "array" },
    materialGroups: {
      type: "array",
      items: kMaterialGroupSchema
    },
    layers: { type: "array" },
    objectLayers: { type: "array" }
  },
  required: [
    "version",
    "chunkSize",
    "tilesets",
    "layers"
  ]
};

function commandVariant(
  action: string,
  properties: Record<string, JSONSchema>
): JSONSchema {
  return {
    type: "object",
    properties: {
      ...commandHeaderProperties,
      action: { const: action },
      ...properties
    },
    required: [
      ...COMMAND_HEADER_REQUIRED,
      "action",
      ...Object.keys(properties)
    ]
  };
}

export const voxelCommandProtocol: MessageProtocol = defineMessageProtocol({
  schema: {
    oneOf: [
      ...Object.entries(kLayerMetadataSchemas).map(
        ([action, metadata]) => commandVariant(action, {
          layerName: { type: "string" },
          metadata
        })
      ),
      ...Object.entries(kBlockCommandProperties).map(
        ([action, properties]) => commandVariant(action, properties)
      ),
      ...Object.entries(kTilesetCommandProperties).map(
        ([action, properties]) => commandVariant(action, properties)
      ),
      ...Object.entries(kMaterialGroupCommandProperties).map(
        ([action, properties]) => commandVariant(action, properties)
      ),
      commandVariant("world-replace", {
        data: voxelWorldSchema
      })
    ]
  }
});
