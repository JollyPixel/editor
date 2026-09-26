// Import Third-party Dependencies
import {
  COMMAND_HEADER_REQUIRED,
  commandHeaderProperties,
  defineSchema,
  type JSONSchema
} from "@jolly-pixel/network";
import { MAX_TILE_SIZE } from "@jolly-pixel/voxel.renderer";

export const tileSizeSchema = defineSchema({
  type: "integer",
  minimum: 1,
  maximum: MAX_TILE_SIZE
});

export function objectSchema(
  properties: Record<string, JSONSchema>,
  required: readonly string[] = Object.keys(properties)
): JSONSchema {
  return {
    type: "object",
    properties,
    required: [...required]
  };
}

/**
 * A command message: the network header, one action and its own fields.
 */
export function commandVariant(
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
