// Import Third-party Dependencies
import {
  COMMAND_HEADER_REQUIRED,
  commandHeaderProperties,
  defineMessageProtocol,
  serverMessageProtocol,
  type JSONSchema,
  type MessageProtocol,
  type MessageProtocols
} from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  VOXEL_BLOCK_HOOK_ACTIONS,
  VOXEL_LAYER_HOOK_ACTIONS
} from "../hooks.ts";

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

export const voxelWorldSchema: JSONSchema = {
  type: "object",
  properties: {
    version: { const: 1 },
    chunkSize: { type: "number" },
    tilesets: { type: "array" },
    layers: { type: "array" }
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
      ...VOXEL_LAYER_HOOK_ACTIONS.map((action) => commandVariant(action, {
        layerName: { type: "string" },
        metadata: { type: "object" }
      })),
      commandVariant("block-defined", { block: { type: "object" } }),
      commandVariant("block-removed", { blockId: { type: "number" } }),
      commandVariant("world-replace", { data: voxelWorldSchema })
    ]
  }
});

export const VOXEL_COMMAND_ACTIONS: readonly string[] = [
  ...VOXEL_LAYER_HOOK_ACTIONS,
  ...VOXEL_BLOCK_HOOK_ACTIONS,
  "world-replace"
];

export const voxelProtocols: MessageProtocols = {
  inbound: voxelCommandProtocol,
  outbound: serverMessageProtocol({
    command: voxelCommandProtocol,
    snapshot: voxelWorldSchema
  })
};
