// Import Third-party Dependencies
import {
  defineMessageProtocol,
  type JSONSchema,
  type MessageProtocol
} from "@jolly-pixel/network";
import {
  MAX_TILESET_SLOT,
  VOXEL_WORLD_VERSION,
  type VoxelLayerCommandAction,
  type VoxelTilesetCommandAction
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  commandVariant,
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

const kSlotSchema: JSONSchema = {
  type: "integer",
  minimum: 0,
  maximum: MAX_TILESET_SLOT
};

/**
 * A tileset link names an asset, or a URL with its tile size.
 */
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
    chunkSize: { type: "number" },
    tilesets: {
      type: "array",
      items: tilesetDefinitionSchema
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

export const voxelCommandProtocol: MessageProtocol = defineMessageProtocol({
  schema: {
    oneOf: [
      ...Object.entries(kLayerMetadataSchemas).map(
        ([action, metadata]) => commandVariant(action, {
          layerName: { type: "string" },
          metadata
        })
      ),
      ...Object.entries(kTilesetCommandProperties).map(
        ([action, properties]) => commandVariant(action, properties)
      ),
      commandVariant("world-replace", {
        data: voxelWorldSchema
      })
    ]
  }
});
