// Import Third-party Dependencies
import {
  commandVariant,
  defineSchema,
  withCommandHeader,
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

export function networkCommand(
  action: string,
  properties: Record<string, JSONSchema>
): JSONSchema {
  return withCommandHeader(commandVariant(action, properties));
}
